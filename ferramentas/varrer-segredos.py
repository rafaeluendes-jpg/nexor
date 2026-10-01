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
    ('senha de banco em texto', re.compile(r'(?i)\b(db_pass|dbpassword|postgres_password|pgpassword)\s*[:=]\s*["\']?[^\s"\']{6,}'), GRAVE,
     'conexao direta ao banco'),
    ('token do GitHub', re.compile(r'gh[pousr]_[A-Za-z0-9]{30,}'), GRAVE,
     'permite escrever nos seus repositorios'),
    ('token do Asaas', re.compile(r'\$aact_[A-Za-z0-9_=\-]{20,}'), GRAVE,
     'movimenta cobranca de verdade'),
    ('senha em codigo', re.compile(r'(?i)\b(senha|password|passwd|pwd)\s*[:=]\s*["\'][^"\'\s]{6,}["\']'), GRAVE,
     'entra no sistema como se fosse voce'),
    ('AWS', re.compile(r'AKIA[0-9A-Z]{16}'), GRAVE, 'acesso a conta de nuvem'),
    ('token do WhatsApp/Meta', re.compile(r'EAA[A-Za-z0-9]{40,}'), GRAVE,
     'manda mensagem em nome da sua pagina'),
    ('string de conexao com senha', re.compile(r'(?i)postgres(ql)?://[^\s:@"\']+:[^\s@"\']+@'), GRAVE,
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
                            if ehTeste and rotulo in ('senha em codigo', 'senha de banco em texto'):
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
    nomes = b'\n'.join(l.split(b' ')[0] for l in objetos.split(b'\n') if l)
    tipos = rodar(['git', 'cat-file',
                   '--batch-check=%(objectname) %(objecttype) %(objectsize)'], nomes)
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
            print('    %-34s %-9s %s' % (a['tipo'], a['gravidade'], a['amostra']))
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
