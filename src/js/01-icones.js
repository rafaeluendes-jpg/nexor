/* ===== BLOCO 1 — ICONES ===== */
var I={
book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
pos:'<rect x="5" y="2" width="14" height="20" rx="2.5"/><line x1="9" y1="6" x2="15" y2="6"/><circle cx="9" cy="11" r=".9"/><circle cx="12" cy="11" r=".9"/><circle cx="15" cy="11" r=".9"/><circle cx="9" cy="15" r=".9"/><circle cx="12" cy="15" r=".9"/><circle cx="15" cy="15" r=".9"/>',
money:'<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>',
file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
box:'<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
chart:'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
store:'<path d="M3 9l1.5-5h15L21 9M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
cima:'<polyline points="18 15 12 9 6 15"/>',
baixo:'<polyline points="6 9 12 15 18 9"/>',
help:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/>',
search:'<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.6" y2="16.6"/>',
dn:'<polyline points="6 9 12 15 18 9"/>',
cr:'<polyline points="9 18 15 12 9 6"/>',
eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
eyeOff:'<path d="M17.9 18A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.1-6M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
edit:'<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
out:'<path d="M18.4 6.6a9 9 0 1 1-12.8 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
dots:'<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
img:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
cloud:'<path d="M18 18.5a4 4 0 0 0 0-8 6 6 0 0 0-11.6-1.4A4.2 4.2 0 0 0 6.5 18.5z"/>',
cart:'<circle cx="9" cy="20" r="1.4"/><circle cx="19" cy="20" r="1.4"/><path d="M2 2h3l2.6 12.4a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 2-1.6L22 6H6"/>',
list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/>',
pin:'<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.5-3V5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9z"/>',
cr2:'<polyline points="15 18 9 12 15 6"/>',
up3:'<polyline points="18 15 12 9 6 15"/>',
grip:'<circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
cake:'<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><line x1="2" y1="21" x2="22" y2="21"/><path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/><line x1="12" y1="2" x2="12" y2="5"/>',
copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
up4:'<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
dn4:'<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.7a2 2 0 0 0-2 1.7l-1.4 9a2 2 0 0 0 2 2.3zm7-13h2.7A2 2 0 0 1 22 4v7a2 2 0 0 1-2 2h-3"/>',
troca:'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
tri:'<polygon points="6 3 18 12 6 21" fill="currentColor" stroke="none"/>',
nike:'<path d="M2 13.2 6.6 16 22 5.5 8.4 19 2 13.2z" fill="currentColor" stroke="none"/>',
file2:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
folderOpen:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3z"/><path d="M3 10h18l-2 8a2 2 0 0 1-2 1.6H5A2 2 0 0 1 3 18z"/>',
phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.2-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7A2 2 0 0 1 22 16.9z"/>',
menu2:'<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
down2:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
up2:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
gear2:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 8 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 3.6 8a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
moto:'<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17h6l4-9h3M12 8h4"/>',
qr:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><line x1="14" y1="14" x2="14" y2="21"/><line x1="18" y1="14" x2="21" y2="14"/><line x1="18" y1="18" x2="21" y2="21"/>',
x2:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
minus:'<line x1="5" y1="12" x2="19" y2="12"/>',
print2:'<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
check:'<polyline points="20 6 9 17 4 12"/>',
ref:'<polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>'
};
/* ==========================================================
   ICONES COLORIDOS DOS MODULOS
   Os icones do menu eram todos de traco fino, na mesma cor, e nao
   distinguiam um modulo do outro. Estes sao preenchidos, com dois tons, e
   mostram a COISA: a maquininha, o pote de gelato, a nota com selo de
   cifrao, a caixa de estoque. Cada modulo com sua cor, reconhecivel de
   relance sem precisar ler.
   Ficam separados do dicionario I{} de proposito: aquele e de traco unico e
   herda a cor do texto (currentColor), usado no resto do sistema. Estes tem
   cor propria e valem so onde o MODULO aparece.
   ========================================================== */
var ICM={
 /* ==========================================================
    ICONES DE LINHA — 2px, cantos retos
    Massa colorida com cantos arredondados e linguagem de adesivo. Software de
    gestao usa linha: o icone vira SINAL, nao ilustracao.
    stroke-linecap=square e linejoin=miter dao a firmeza tecnica — com ponta
    arredondada o mesmo desenho volta a parecer infantil.
    ATENCAO: desenhados na escala 0-24. A moldura em svMod TEM de ser
    viewBox="0 0 24 24". Na V41 eu deixei 32 e os icones sumiram da tela.
    ========================================================== */
 pdv:'<rect x="3" y="4" width="18" height="13"/><path d="M7 21h10M7 8h10M7 12h5"/>',
 cardapio:'<rect x="4" y="3" width="16" height="18"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 financeira:'<path d="M12 2v20M17 5.5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
 clientes:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/>'+
     '<circle cx="17" cy="9.5" r="2.5"/><path d="M15 20a5 5 0 016.5-4.8"/>',
 estoque:'<path d="M12 2.5l8.5 4.7v9.6L12 21.5 3.5 16.8V7.2z"/>'+
     '<path d="M12 12l8.5-4.8M12 12v9.5M12 12L3.5 7.2"/>',
 relatorios:'<path d="M3 21h18"/><path d="M6 21v-7M12 21V8M18 21v-4"/>',
 dashboard:'<path d="M12 3a9 9 0 109 9h-9z"/><path d="M12 3v9h9"/>',
 loja:'<path d="M3 21V9.5L12 3l9 6.5V21z"/><path d="M9.5 21v-6h5v6"/>',
 controle:'<path d="M5 3h14v18l-4-3-3 3-3-3-4 3z"/><path d="M9 8h6M9 12h4"/>',
 tecnico:'<circle cx="12" cy="12" r="3.2"/>'+
     '<path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3'+
     'M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>'
};

/* icone do modulo: colorido quando existe, senao o de traco de sempre */
function svMod(mid, ic, tam) {
  tam = tam || 21;
  if (ICM[mid])
    return '<svg width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" ' +
           'fill="none" stroke="currentColor" stroke-width="2" ' +
           'stroke-linecap="square" stroke-linejoin="miter">' + ICM[mid] + '</svg>';
  return sv(ic, tam, 1.5);
}
function sv(n,s,w){s=s||16;return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(w||1.7)+'" stroke-linecap="round" stroke-linejoin="round">'+(I[n]||'')+'</svg>';}
