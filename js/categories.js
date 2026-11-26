// Categorie predefinite (come nel vecchio foglio) e riconoscimento automatico per parole chiave.
// Le correzioni dell'utente diventano regole (store.rules) e vincono sulle parole chiave.

export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();

// kind: "var" spese variabili, "fix" fisse/bollette
export const DEFAULT_CATS = [
  { id: "food", icon: "c-food", emoji: "🥕", color: "#7cc576", kind: "var" },
  { id: "clean", icon: "c-clean", emoji: "🧽", color: "#6cc3d5", kind: "var" },
  { id: "hygiene", icon: "c-hygiene", emoji: "🧴", color: "#b59cf0", kind: "var" },
  { id: "home", icon: "c-home", emoji: "🏠", color: "#f0a35e", kind: "var" },
  { id: "gifts", icon: "c-gifts", emoji: "🎁", color: "#f27fa5", kind: "var" },
  { id: "toys", icon: "c-toys", emoji: "🧸", color: "#f5c04a", kind: "var" },
  { id: "pets", icon: "c-pets", emoji: "🐾", color: "#c8a27a", kind: "var" },
  { id: "fun", icon: "c-fun", emoji: "🍹", color: "#ff8e72", kind: "var" },
  { id: "holiday", icon: "c-holiday", emoji: "🏖️", color: "#4fb3bf", kind: "var" },
  { id: "tobacco", icon: "c-tobacco", emoji: "🚬", color: "#9e9e9e", kind: "var" },
  { id: "tech", icon: "c-tech", emoji: "💻", color: "#7a8cf0", kind: "var" },
  { id: "furniture", icon: "c-furniture", emoji: "🛋️", color: "#d1a06b", kind: "var" },
  { id: "renovation", icon: "c-renovation", emoji: "🔨", color: "#b0876b", kind: "var" },
  { id: "clothes", icon: "c-clothes", emoji: "👕", color: "#e98bd0", kind: "var" },
  { id: "health", icon: "c-health", emoji: "💊", color: "#ef6f6c", kind: "var" },
  { id: "transport", icon: "c-transport", emoji: "🚌", color: "#5fa8e8", kind: "var" },
  { id: "school", icon: "c-school", emoji: "📚", color: "#8fbf5a", kind: "var" },
  { id: "donations", icon: "c-donations", emoji: "💝", color: "#f49ac1", kind: "var" },
  { id: "admin", icon: "c-admin", emoji: "📋", color: "#a1a1c8", kind: "var" },
  { id: "elec", icon: "c-elec", emoji: "⚡", color: "#f7d046", kind: "fix" },
  { id: "gas", icon: "c-gas", emoji: "🔥", color: "#ff9f43", kind: "fix" },
  { id: "water", icon: "c-water", emoji: "💧", color: "#48b6f0", kind: "fix" },
  { id: "internet", icon: "c-internet", emoji: "📶", color: "#6c9cf0", kind: "fix" },
  { id: "subs", icon: "c-subs", emoji: "📺", color: "#a07cf0", kind: "fix" },
  { id: "tvfee", icon: "c-tvfee", emoji: "📡", color: "#8e9ad6", kind: "fix" },
  { id: "waste", icon: "c-waste", emoji: "🗑️", color: "#8fb39a", kind: "fix" },
  { id: "condo", icon: "c-condo", emoji: "🏢", color: "#b8a28e", kind: "fix" },
  { id: "mortgage", icon: "c-mortgage", emoji: "🔑", color: "#c97b63", kind: "fix" },
  { id: "other", icon: "c-other", emoji: "✨", color: "#bdbdbd", kind: "var" },
];

// Parole chiave (normalizzate). Prima l'italiano, poi termini comuni in altre lingue e nomi di negozi/fornitori.
const KW = {
  food: "supermercato supermarket ipermercato minimarket market alimentari discount gastronomia salumeria panetteria macelleria pescheria fruttivendolo latte pane pasta riso uova uovo yogurt formaggio mozzarella parmigiano grana prosciutto salame carne pollo tacchino manzo maiale pesce tonno salmone frutta verdura mela mele banana banane arance pomodori pomodoro insalata patate cipolle zucchine carote biscotti cereali farina zucchero sale olio aceto caffe acqua minerale bibita succo birra vino cioccolato gelato surgelati pizza merendine crackers fette burro panna legumi ceci fagioli lenticchie spezie sugo passata pesto snack dolci torta croissant brioche bio frutta_secca noci mandorle milk bread eggs cheese meat chicken fish fruit vegetables coffee tea juice beer wine water rice brot milch kase fleisch obst gemuse pain lait fromage viande leche pan queso carne polpette polpetta polp pure bevanda bevande bibite succhi aranciata limonata chinotto crodino sanbitter aperol cola spumante prosecco wrap hummus frittura fritto gamberi gamberetti crostata dolce cornetto cappuccino espresso panino panini tramezzino piadina focaccia hotdog hot_dog patatine piselli marmellata confettura salsa salse ketchup maionese senape salmone_affumicato aringhe uova_sode menu pasto pranzo cena colazione".split(" "),
  clean: "detersivo detergente ammorbidente candeggina sgrassatore anticalcare pavimenti piatti lavastoviglie pastiglie spugna spugne panno panni carta_cucina scottex rotoli sacchetti sacchi_immondizia stracci scopa mocio lavatrice bucato dash dixan svelto finish cif viakal ace swiffer detergent dish softener bleach waschmittel lessive det deterg detersivi lavapavimenti lavapiatti igienizzante disinfettante smacchiatore profumatore deodorante_ambiente chanteclair nelsen bref pril omino perlana coccolino lenor vernel quasar glassex smac napisan calgon lysoform amuchina mastro_lindo spontex vileda domopak cuki presto".split(" "),
  hygiene: "shampoo balsamo bagnoschiuma docciaschiuma sapone dentifricio spazzolino collutorio deodorante rasoio lamette schiuma_barba assorbenti tamponi pannolini salviette cotone cotton_fioc crema_viso corpo carta_igienica fazzoletti trucco mascara rossetto profumo nivea colgate gillette toothpaste soap deodorant razor diapers tissues".split(" "),
  home: "lampadina lampadine pile batterie candela candele vaso piante pianta fiori bricolage attrezzi utensili cucina pentola padella bicchieri piatti posate tovaglia asciugamani lenzuola cuscino tenda ikea leroy brico obi tigota casa home".split(" "),
  gifts: "regalo regali confezione_regalo bigliettino biglietto auguri gift geschenk cadeau".split(" "),
  toys: "giocattolo giocattoli gioco giochi lego peluche bambola puzzle costruzioni pastelli pennarelli colori toys toy spielzeug jouet juguete".split(" "),
  pets: "crocchette croccantini lettiera cane gatto pet animali umido monge purina whiskas".split(" "),
  fun: "ristorante pizzeria bar aperitivo cocktail cinema teatro concerto pub discoteca sushi kebab trattoria osteria pasticceria gelateria deliveroo glovo justeat just_eat uber_eats restaurant cafe".split(" "),
  holiday: "hotel albergo booking airbnb volo voli ryanair easyjet vacanza vacanze traghetto biglietti museo".split(" "),
  tobacco: "sigarette tabacco tabacchi cartine filtri iqos heets terea marlboro camel winston chesterfield".split(" "),
  tech: "cavo caricatore cuffie auricolari usb hdmi mouse tastiera smartphone telefono tablet pc computer elettronica mediaworld unieuro euronics apple samsung".split(" "),
  furniture: "mobile mobili divano sedia sedie tavolo armadio letto materasso scaffale libreria comodino".split(" "),
  renovation: "vernice pittura pennello stucco silicone cemento piastrelle idraulico elettricista muratore ristrutturazione viti tasselli trapano".split(" "),
  clothes: "maglia maglietta tshirt pantaloni jeans camicia giacca giubbotto scarpe calze calzini mutande intimo pigiama felpa vestito gonna zara h&m hm primark decathlon ovs calzedonia".split(" "),
  health: "farmacia parafarmacia farmaco farmaci medicina ticket visita dentista oculista analisi tachipirina moment aspirina vitamine integratori cerotti termometro ottico occhiali lenti pharmacy apotheke".split(" "),
  transport: "benzina gasolio diesel carburante rifornimento autostrada telepass pedaggio parcheggio treno trenitalia italo bus autobus metro abbonamento atm taxi uber bolt car_sharing enjoy share_now eni q8 tamoil esso shell".split(" "),
  school: "libro libri quaderno quaderni penna penne matite zaino astuccio scuola corso università retta mensa feltrinelli mondadori".split(" "),
  donations: "donazione offerta beneficenza onlus".split(" "),
  admin: "bollo marca_da_bollo raccomandata posta poste spedizione commissione notaio anagrafe".split(" "),
  elec: "energia_elettrica luce enel edison a2a hera iren acea sorgenia kwh".split(" "),
  gas: "gas metano smc plenitude eni_gas".split(" "),
  water: "servizio_idrico acquedotto acqua_potabile".split(" "),
  internet: "tim vodafone windtre wind fastweb iliad ho_mobile kena very sky wifi fibra internet ricarica".split(" "),
  subs: "netflix spotify disney prime amazon_prime dazn youtube_premium apple_music icloud google_one abbonamento palestra".split(" "),
  tvfee: "canone_rai canone_tv".split(" "),
  waste: "tari rifiuti ama amsa".split(" "),
  condo: "condominio amministratore condominiale".split(" "),
  mortgage: "mutuo rata_mutuo affitto canone_locazione".split(" "),
};
// Negozi di alimentari: lo scontrino intero va lì se non si riconosce la riga
export const GROCERS = "esselunga coop conad lidl eurospin aldi carrefour pam penny md despar spar iper ipercoop tigros famila bennet unes simply crai sigma todis naturasi interspar lidl rewe edeka mercadona auchan leclerc tesco sainsbury".split(" ");

const KW_INDEX = (() => {
  const single = new Map(), multi = [];
  for (const [cat, words] of Object.entries(KW)) for (const w of words) {
    const n = norm(w.replace(/_/g, " ")); if (!n || n.length < 3) continue;
    if (n.includes(" ")) multi.push([n, cat]); else if (!single.has(n)) single.set(n, cat);
  }
  return { single, multi };
})();

/** Categorie probabili per un nome di prodotto/movimento. rules = { "nome normalizzato": [cat...] } */
export function guessCats(name, rules = {}, fallback = "other") {
  const n = norm(name);
  if (!n) return [fallback];
  if (rules[n]) return rules[n];
  // regola appresa su una parola iniziale (es. "LATTE PS UHT" → "latte")
  const first2 = n.split(" ").slice(0, 2).join(" "), first = n.split(" ")[0];
  if (rules[first2]) return rules[first2];
  if (rules[first]) return rules[first];
  for (const [m, cat] of KW_INDEX.multi) if (n.includes(m)) return [cat];
  for (const w of n.split(" ")) {
    if (KW_INDEX.single.has(w)) return [KW_INDEX.single.get(w)];
    // abbreviazioni da scontrino: "DETERS." "BISC" → prefissi di almeno 4 lettere
    if (w.length >= 4) for (const [k, cat] of KW_INDEX.single) if (k.length >= 5 && k.startsWith(w)) return [cat];
  }
  return [fallback];
}

/** Categoria tipica di un negozio: quella imparata, "alimentari" per i supermercati, altrimenti dalle parole chiave (IKEA → casa). */
export const storeKey = s => "negozio " + norm(s);
export function storeCat(store, rules = {}) {
  const n = norm(store); if (!n) return null;
  if (rules[storeKey(store)]) return rules[storeKey(store)][0];
  if (isGrocer(n)) return "food";
  return guessCats(n, {}, null)[0];
}

/**
 * Categorie per le righe di uno scontrino, guardando insieme prodotti e negozio.
 * 1) regola imparata o parola chiave del prodotto; 2) i prodotti non riconosciuti prendono la categoria
 * prevalente fra quelli riconosciuti (se sono almeno la metà), altrimenti quella del negozio.
 * Esempio: da IKEA solo cibo → le righe ignote vanno in alimentari, non in casa.
 * @returns {{ cats: string[][], main: string }} main = categoria suggerita per "solo totale"
 */
export function guessReceipt(items, store, rules = {}) {
  const known = items.map(it => (it.cats?.length ? it.cats : guessCats(it.name, rules, null).filter(Boolean)));
  const weight = cs => { const w = {}; cs.forEach((c, i) => c.length && c.forEach(x => (w[x] = (w[x] || 0) + (Math.abs(items[i].amount) || 1) / c.length))); return Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
  const major = weight(known), share = known.filter(c => c.length).length / (items.length || 1), sc = storeCat(store, rules);
  const fb = (share >= 0.5 && major) || sc || major || "other";
  const cats = known.map(c => (c.length ? c : [fb]));
  return { cats, main: rules[storeKey(store)]?.[0] && share < 0.5 ? rules[storeKey(store)][0] : weight(cats) || fb };
}

export const isGrocer = s => { const n = norm(s); return GROCERS.some(g => n.includes(g)); };

/** Nome mostrato: personalizzato dall'utente oppure traduzione "cat.<id>". */
/** Icona: font kapi-icons per le categorie predefinite, emoji per quelle create dall'utente. */
export const catIcon = c => (c?.icon && !c.custom ? `<i class="ki ki-${c.icon}" aria-hidden="true"></i>` : `<span aria-hidden="true">${c?.emoji || "✨"}</span>`);

export const catName = (c, t) => (c && (c.name || t("cat." + c.id))) || "?";
