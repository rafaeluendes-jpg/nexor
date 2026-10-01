#!/usr/bin/env python3
"""Varredura de segredo exposto — no código de hoje e no histórico.

    python3 ferramentas/varrer-segredos.py <pasta> [nome]
    python3 ferramentas/varrer-segredos.py --historico <espelho.git> [nome]

O segundo modo é o que importa em repositório público: segredo apagado
ontem continua legível no commit de anteontem. Ele varre objeto por objeto,
todos os ramos, todos os commits — e foi provado contra defeito plantado.

Nunca imprime o segredo: mostra o tipo, o arquivo, a linha e um pedaco
mascarado, o bastante para achar e trocar. O proprio relatorio nao pode
virar o vazamento.

Separa o que e segredo de verdade (chave que da acesso de escrita) do que
e publico por natureza (a chave anon do Supabase vai no navegador de
qualquer jeito, e so vale com as regras de linha ligadas).
"""
import os, re, sys, json

GRAVE, MEDIO, OK = 'GRAVE', 'ATENCAO', 'esperado'

REGRAS = [
    # (nome, regex, gravidade, por que)
    ('chave privada SSH/PGP', re.compile(r'-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----'), GRAVE,
     'da acesso direto ao servidor ou assina no seu nome'),
    # A PALAVRA service_role aparece em SQL legitimo ("grant ... to service_role")
    # e em documentacao. O perigo e a CHAVE com esse papel dentro, e ela e um
    # JWT — tratada abaixo, decodificando o conteudo em vez de adivinhar.
    # O valor vai no grupo 1 de propósito: é ele que passa pela peneira do
    # so_referencia. Antes a regra capturava o NOME, então `POSTGRES_PASSWORD=
    # ${SENHA_BANCO}` — senha gerada na hora com openssl — era acusada de
    # vazamento. Três acusações falsas no histórico do Joia, encontradas assim.
    ('senha de banco em texto', re.compile(
        r'(?i)\b(?:db_pass|dbpassword|postgres_password|pgpassword)\s*[:=]\s*["\']?([^\s"\']{4,})'), GRAVE,
     'conexao direta ao banco'),
    ('token do GitHub', re.compile(r'gh[pousr]_[A-Za-z0-9]{30,}'), GRAVE,
     'permite escrever nos seus repositorios'),
    ('token do Asaas', re.compile(r'\$aact_[A-Za-z0-9_=\-]{20,}'), GRAVE,
     'movimenta cobranca de verdade'),
    # BURACO ENCONTRADO EM 01/10/2026: a versao antiga exigia \b antes da
    # palavra. Em SEED_OWNER_PASSWORD o "_" conta como letra, entao \bpassword
    # nao casava — e a senha passou batida, justamente na forma mais comum em
    # arquivo de ambiente e de docker.
    #
    # A primeira tentativa de consertar errou para o outro lado: virou ruido.
    # "deSENHAr" contem "senha", e `senha = campo.valor` nao e senha gravada.
    # 82 acusacoes falsas num repositorio so. Daí as duas travas:
    #
    #   (?<![a-z])  o nome nao pode vir logo depois de letra — mata desenhar
    #   valor LITERAL, entre aspas — mata nome de classe de CSS e atribuicao
    #
    # Senha curta entra: senha de gente costuma ser curta, e e a pior de vazar.
    ('senha em codigo', re.compile(
        r'(?i)[a-z0-9_.\-]*(?<![a-z])(?:senha|password|passwd|pwd)[a-z0-9_.\-]*'
        r'\s*[:=]\s*["\']([^"\'\s]{4,})["\']'), GRAVE,
     'entra no sistema como se fosse voce'),
    # A outra forma de escrever a mesma coisa: arquivo de ambiente e de docker,
    # onde o nome vem em maiusculas e o valor nao leva aspas nenhuma.
    ('senha em arquivo de ambiente', re.compile(
        r'^\s*(?:export\s+|-\s+)?[A-Z0-9_]*(?<![A-Z])(?:SENHA|PASSWORD|PASSWD|PWD)[A-Z0-9_]*'
        r'\s*[:=]\s*["\']?([^\s"\'#]{4,})["\']?\s*$'), GRAVE,
     'entra no sistema como se fosse voce'),
    ('AWS', re.compile(r'AKIA[0-9A-Z]{16}'), GRAVE, 'acesso a conta de nuvem'),
    ('token do WhatsApp/Meta', re.compile(r'EAA[A-Za-z0-9]{40,}'), GRAVE,
     'manda mensagem em nome da sua pagina'),
    ('string de conexao com senha', re.compile(
        r'(?i)postgres(?:ql)?://[^\s:@"\']+:([^\s@"\']+)@'), GRAVE,
     'conexao direta ao banco, ja com a senha'),
    ('chave VAPID privada', re.compile(r'(?i)vapid[_a-z]*private[_a-z]*\s*[:=]\s*["\'][A-Za-z0-9_\-]{20,}'), GRAVE,
     'permite disparar notificacao como se fosse o sistema'),

    ('chave publicavel do Supabase', re.compile(r'sb_publishable_[A-Za-z0-9_\-]{10,}'), OK,
     'nasce para ir ao navegador; so vale com RLS ligada'),
    ('api_key generica', re.compile(r'(?i)\b(api[_-]?key|apikey|secret|token)\s*[:=]\s*["\'][A-Za-z0-9_\-]{16,}["\']'), MEDIO,
     'depende do que a chave abre'),
]

IGNORA_DIR = {'.git', 'node_modules', 'dist', 'build', '.next', 'vendor', '__pycache__', '.cache'}
IGNORA_EXT = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.tgz',
              '.gz', '.mp4', '.mp3', '.woff', '.woff2', '.ttf', '.eot', '.lock'}

RX_JWT = re.compile(r'eyJ[A-Za-z0-9_\-]{8,}\.(eyJ[A-Za-z0-9_\-]{8,})\.[A-Za-z0-9_\-]{10,}')

# Valor que aponta para outro lugar nao e segredo: e o jeito certo de fazer.
# Marcador de molde tambem nao. Sem esta peneira a regra larga viraria ruido,
# e relatorio cheio de ruido ninguem le — foi assim que a senha escapou.
RX_REFERENCIA = re.compile(
    r'(?i)^\s*('
    r'process\.env|import\.meta\.env|Deno\.env|os\.environ|getenv'
    r'|env[\[.]|ENV[\[.]|\$\{|\$[A-Za-z_(]|%[A-Za-z_]'
    r'|config\.|settings\.|secrets?\.|vars\.|input\.|opts?\.|args?\.'
    r'|<|\[|\{\{|\(\(|""|\'\'|null|nil|none|undefined|true|false'
    r')')

RX_MARCADOR = re.compile(
    r'(?i)xxx|cole|coloque|sua[-_ ]?senha|seu[-_ ]?token|troque'
    r'|change[-_ ]?me|changeit|example|exemplo|placeholder|aqui'
    r'|your[-_ ]|fake|dummy|redigido|redacted|\.\.\.|\*\*\*'
    # a propria palavra, sozinha, e marcador: documentacao escreve
    # postgresql://jolo:SENHA@... para a pessoa trocar
    r'|^(senha|password|secret|token|chave|key|user|usuario)$')


def so_referencia(valor):
    """O valor aponta para outro lugar, ou e so marcador de molde?"""
    v = (valor or '').strip()
    return bool(RX_REFERENCIA.match(v)) or bool(RX_MARCADOR.search(v))

def papel_do_jwt(token_meio):
    """Le o papel declarado dentro do JWT, sem validar assinatura.

    E a unica forma honesta de separar a chave anon (feita para ir ao
    navegador) da service_role (que ignora toda a seguranca do banco).
    Procurar pela palavra 'service_role' no arquivo acusa SQL legitimo."""
    import base64
    try:
        s = token_meio + '=' * (-len(token_meio) % 4)
        dados = json.loads(base64.urlsafe_b64decode(s).decode('utf-8', 'ignore'))
        return str(dados.get('role') or dados.get('iss') or 'sem papel')
    except Exception:
        return 'ilegivel'

def mascarar(t):
    t = t.strip()
    if len(t) <= 14:
        return t[:4] + '…'
    return t[:8] + '…' + t[-4:] + ' (' + str(len(t)) + ' car.)'

def varrer(raiz):
    achados = []
    for pasta, dirs, arqs in os.walk(raiz):
        dirs[:] = [d for d in dirs if d not in IGNORA_DIR]
        for nome in arqs:
            if os.path.splitext(nome)[1].lower() in IGNORA_EXT:
                continue
            caminho = os.path.join(pasta, nome)
            try:
                if os.path.getsize(caminho) > 12 * 1024 * 1024:
                    continue
                with open(caminho, encoding='utf-8', errors='ignore') as f:
                    for n, linha in enumerate(f, 1):
                        if len(linha) > 300000:
                            continue
                        # JWT: decide pelo conteudo, nao pelo palpite
                        for mj in RX_JWT.finditer(linha):
                            papel = papel_do_jwt(mj.group(1))
                            grave = papel == 'service_role'
                            achados.append({
                                'arquivo': os.path.relpath(caminho, raiz),
                                'linha': n,
                                'tipo': 'CHAVE %s do Supabase' % papel,
                                'gravidade': GRAVE if grave else (OK if papel == 'anon' else MEDIO),
                                'porque': ('ignora TODAS as regras do banco: le, altera e apaga tudo'
                                           if grave else
                                           'nasce para ir ao navegador; so vale com RLS ligada'
                                           if papel == 'anon' else 'papel desconhecido, conferir'),
                                'amostra': mascarar(mj.group(0)),
                            })
                        # Imagem embutida em base64 produz trechos que parecem
                        # token (EAAE..., AKIA...). Nao e segredo: e o icone.
                        # Base64 de imagem tambem aparece sem o prefixo data:.
                        # iVBORw = PNG, R0lGOD = GIF, /9j/ = JPEG, AAABAA = ICO.
                        ehImagem = ('data:image/' in linha or 'data:font/' in linha
                                    or 'iVBORw0KGgo' in linha or 'R0lGODlh' in linha
                                    or '/9j/4AA' in linha)
                        # Teste de seguranca precisa de uma senha de mentira como
                        # ENTRADA para provar que ela e removida. Acusar isso e ruido.
                        ehTeste = re.search(r'(?i)(^|/)(test|teste|spec|mock|fixture)',
                                            os.path.relpath(caminho, raiz)) is not None
                        for rotulo, rx, grav, porque in REGRAS:
                            m = rx.search(linha)
                            if not m:
                                continue
                            if ehImagem and rotulo in ('token do WhatsApp/Meta', 'AWS'):
                                continue
                            # So esta regra captura o VALOR no grupo 1. Aplicar a
                            # peneira nas outras seria peneirar o nome da chave
                            # em vez do segredo, e deixar passar o que importa.
                            if rotulo in ('senha em codigo', 'senha em arquivo de ambiente',
                                          'senha de banco em texto',
                                          'string de conexao com senha') \
                               and so_referencia(m.group(1)):
                                continue
                            if ehTeste and rotulo in ('senha em codigo', 'senha de banco em texto',
                                                      'senha em arquivo de ambiente'):
                                grav = OK
                                porque = 'arquivo de teste: senha de mentira, conferir so por garantia'
                            achados.append({
                                'arquivo': os.path.relpath(caminho, raiz),
                                'linha': n, 'tipo': rotulo, 'gravidade': grav,
                                'porque': porque, 'amostra': mascarar(m.group(0)),
                            })
            except (OSError, UnicodeDecodeError):
                continue
    return achados

RX_BRUTO = (rb'gh[pousr]_[A-Za-z0-9]{30,}'
            rb'|\$aact_[A-Za-z0-9_=-]{20,}'
            rb'|AKIA[0-9A-Z]{16}'
            rb'|-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----'
            rb'|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')


def varrer_historico(espelho):
    """Todo blob de todo commit de todo ramo, uma vez cada.

    Vale mais que varrer a pasta: o que foi apagado num commit seguinte
    continua lá, e é exatamente o segredo que o dono pensa ter removido."""
    import subprocess

    def rodar(args, entrada=None):
        return subprocess.run(args, cwd=espelho, input=entrada,
                              capture_output=True).stdout

    objetos = rodar(['git', 'rev-list', '--objects', '--all'])
    # sha -> caminho. Achado sem caminho é achado que ninguém consegue ir
    # consertar; o `rev-list --objects` já traz o nome ao lado do sha.
    caminho_de = {}
    nomes = []
    for l in objetos.split(b'\n'):
        if not l:
            continue
        sha, _, cam = l.partition(b' ')
        nomes.append(sha)
        if cam:
            caminho_de.setdefault(sha, cam.decode('utf-8', 'ignore'))
    tipos = rodar(['git', 'cat-file',
                   '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
                  b'\n'.join(nomes))
    blobs = []
    for l in tipos.split(b'\n'):
        p = l.split(b' ')
        # arquivo gigante é imagem ou pacote; segredo não mora lá
        if len(p) == 3 and p[1] == b'blob' and int(p[2] or 0) < 20_000_000:
            blobs.append(p[0])
    conteudo = rodar(['git', 'cat-file', '--batch'], b'\n'.join(blobs))

    achados = []
    for m in sorted(set(re.findall(RX_BRUTO, conteudo))):
        t = m.decode('utf-8', 'ignore')
        if t.startswith('eyJ'):
            papel = papel_do_jwt(t.split('.')[1])
            achados.append({
                'tipo': 'CHAVE %s do Supabase' % papel,
                'gravidade': GRAVE if papel == 'service_role'
                             else (OK if papel == 'anon' else MEDIO),
                'arquivo': '(histórico)', 'linha': 0,
                'porque': 'apagar o arquivo não apaga o commit',
                'amostra': mascarar(t)})
        else:
            achados.append({
                'tipo': 'token ou chave privada', 'gravidade': GRAVE,
                'arquivo': '(histórico)', 'linha': 0,
                'porque': 'apagar o arquivo não apaga o commit',
                'amostra': mascarar(t)})

    # SENHA no histórico. Até 01/10/2026 esta varredura só procurava token e
    # chave — senha gravada e depois apagada passava. No repositório público é
    # o pior caso: o commit antigo continua à vista de qualquer um.
    #
    # Blob por blob, com o caminho de cada um: achado sem arquivo ninguém
    # localiza, e sem o caminho não há como saber se é molde ou é de verdade.
    REGRAS_SENHA = [r for r in REGRAS
                    if r[0] in ('senha em codigo', 'senha em arquivo de ambiente',
                                'senha de banco em texto', 'string de conexao com senha')]
    vistas = set()
    pos = 0
    cab = re.compile(rb'^([0-9a-f]{40,64}) (\w+) (\d+)$')
    while pos < len(conteudo):
        fim = conteudo.find(b'\n', pos)
        if fim < 0:
            break
        m = cab.match(conteudo[pos:fim])
        if not m:
            pos = fim + 1
            continue
        sha, tam = m.group(1), int(m.group(3))
        corpo = conteudo[fim + 1:fim + 1 + tam]
        pos = fim + 1 + tam + 1
        cam = caminho_de.get(sha, '(sem caminho)')
        if os.path.splitext(cam)[1].lower() in IGNORA_EXT:
            continue
        # molde (.example/.sample) e teste trazem senha de mentira de propósito
        ehMolde = re.search(r'(?i)\.(example|sample|template|dist)$|\.env\.', cam) is not None
        ehTeste = re.search(r'(?i)(^|/)(test|teste|spec|mock|fixture)', cam) is not None
        for n, linha in enumerate(corpo.decode('utf-8', 'ignore').split('\n'), 1):
            if len(linha) > 4000:
                continue
            for rotulo, rx, grav, porque in REGRAS_SENHA:
                mm = rx.search(linha)
                if not mm or so_referencia(mm.group(1)):
                    continue
                g, pq = grav, porque
                if ehMolde or ehTeste:
                    g = OK
                    pq = ('molde, não senha de verdade' if ehMolde
                          else 'arquivo de teste: senha de mentira')
                chave = (rotulo, cam, mascarar(mm.group(0)))
                if chave in vistas:
                    continue
                vistas.add(chave)
                achados.append({
                    'tipo': rotulo, 'gravidade': g, 'arquivo': cam, 'linha': n,
                    'porque': pq, 'amostra': mascarar(mm.group(0))})

    return achados, len(blobs)


if __name__ == '__main__':
    if sys.argv[1] == '--historico':
        espelho = sys.argv[2]
        nome = sys.argv[3] if len(sys.argv) > 3 else os.path.basename(espelho)
        achados, quantos = varrer_historico(espelho)
        print()
        print('=== %s (histórico: %d arquivos) ===' % (nome, quantos))
        if not achados:
            print('  nada encontrado em nenhum commit de nenhum ramo')
        for a in achados:
            print('    %-30s %-9s %s:%s  %s' % (a['tipo'], a['gravidade'],
                                                a['arquivo'], a['linha'], a['amostra']))
        sys.exit(1 if any(a['gravidade'] == GRAVE for a in achados) else 0)

    raiz = sys.argv[1]
    nome = sys.argv[2] if len(sys.argv) > 2 else os.path.basename(raiz)
    achados = varrer(raiz)
    por_grav = {}
    for a in achados:
        por_grav.setdefault(a['gravidade'], []).append(a)
    print('\n=== %s ===' % nome)
    if not achados:
        print('  nada encontrado')
    for g in (GRAVE, MEDIO, OK):
        lista = por_grav.get(g, [])
        if not lista:
            continue
        print('  %s: %d' % (g, len(lista)))
        vistos = set()
        for a in lista[:14]:
            ch = (a['tipo'], a['arquivo'])
            if ch in vistos:
                continue
            vistos.add(ch)
            print('    %-34s %s:%d  %s' % (a['tipo'], a['arquivo'], a['linha'], a['amostra']))
        if len(lista) > 14:
            print('    ... e mais %d' % (len(lista) - 14))
    json.dump(achados, open('/tmp/varredura-%s.json' % nome.replace('/', '_'), 'w'), ensure_ascii=False)
