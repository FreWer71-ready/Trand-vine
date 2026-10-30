// Kunskapsbank: druvor, vinområden (klimat och jordmån) och sommeliertips,
// så att man lär sig mer om vinet man har. Texterna är allmänna fakta och
// tumregler, inte beskrivningar av den enskilda flaskan. Fungerar offline.
//
// Matchning: druvor från vinets data i första hand; saknas de används
// områdets typiska druvor (visas som "trolig druva").

import type { Locale } from "./i18n.ts";
import type { DrinkPhase } from "./recommend.ts";
import type { WineColor } from "./types.ts";
import { KNOWLEDGE_SOURCES } from "./knowledgeSources.ts";

type L = Record<Locale, string>;
const l = (sv: string, en: string): L => ({ sv, en });

interface GrapeEntry {
  id: string;
  name: string;
  match: RegExp;
  about: L;
  aromas: { sv: string[]; en: string[] };
  structure: L;
  fact: L;
}

interface RegionEntry {
  id: string;
  name: string | L;
  match: RegExp;
  /** Typiska druvor (id i GRAPES), används när vinet saknar druvuppgift. */
  grapes: string[];
  climate: L;
  soil: L;
  style: L;
  fact?: L;
}

// ---------------------------------------------------------------------------
// Druvor

const GRAPES: GrapeEntry[] = [
  {
    id: "cabernet_sauvignon", name: "Cabernet Sauvignon", match: /cabernet sauvignon/i,
    about: l("Världens mest planterade blå druva, med rötter i Bordeaux. Tjockt skal ger mycket färg och tanniner, och vinerna kan lagras länge.",
      "The world's most planted red grape, originally from Bordeaux. Thick skins give deep colour and firm tannins, and the wines can age for decades."),
    aromas: { sv: ["svarta vinbär", "ceder", "grön paprika", "mint", "tobak"], en: ["blackcurrant", "cedar", "green pepper", "mint", "tobacco"] },
    structure: l("Fyllig med fasta tanniner och frisk syra.", "Full-bodied with firm tannins and fresh acidity."),
    fact: l("Druvan är en korsning av Cabernet Franc och Sauvignon Blanc som uppstod spontant på 1600-talet.",
      "It is a natural 17th-century cross of Cabernet Franc and Sauvignon Blanc."),
  },
  {
    id: "merlot", name: "Merlot", match: /merlot/i,
    about: l("Mjuk och generös druva som dominerar på Bordeaux högra strand (Saint-Émilion, Pomerol). Mognar tidigare än Cabernet.",
      "A soft, generous grape that dominates Bordeaux's Right Bank (Saint-Émilion, Pomerol). It ripens earlier than Cabernet."),
    aromas: { sv: ["plommon", "mörka körsbär", "choklad", "örter", "tryffel med ålder"], en: ["plum", "black cherry", "chocolate", "herbs", "truffle with age"] },
    structure: l("Medelfyllig till fyllig, runda tanniner.", "Medium to full body with round tannins."),
    fact: l("Pétrus i Pomerol, ett av världens dyraste viner, görs nästan helt av Merlot.",
      "Pétrus in Pomerol, one of the world's most expensive wines, is almost pure Merlot."),
  },
  {
    id: "pinot_noir", name: "Pinot Noir", match: /pinot noir|spätburgunder|spatburgunder|pinot nero/i,
    about: l("Bourgognes stora blå druva: tunnskalig, svårodlad och känslig för var den växer. Visar tydligt jordmån och klimat.",
      "Burgundy's great red grape: thin-skinned, difficult to grow and very expressive of where it is planted."),
    aromas: { sv: ["röda bär", "körsbär", "jordgubbe", "svamp", "skogsbotten"], en: ["red berries", "cherry", "strawberry", "mushroom", "forest floor"] },
    structure: l("Lätt till medelfyllig, låga tanniner och hög syra.", "Light to medium body, low tannins and high acidity."),
    fact: l("Pinot Noir är också en av de tre huvuddruvorna i champagne.", "Pinot Noir is also one of the three main grapes of Champagne."),
  },
  {
    id: "syrah", name: "Syrah / Shiraz", match: /\b(syrah|shiraz)\b/i,
    about: l("Kommer från norra Rhône (Hermitage, Côte-Rôtie). Kallas Shiraz i Australien, där stilen ofta är fylligare och fruktigare.",
      "From the northern Rhône (Hermitage, Côte-Rôtie). Called Shiraz in Australia, where the style is usually riper and fuller."),
    aromas: { sv: ["björnbär", "svartpeppar", "oliver", "rökt kött", "viol"], en: ["blackberry", "black pepper", "olive", "smoked meat", "violet"] },
    structure: l("Fyllig, kraftig färg, medelhöga till höga tanniner.", "Full-bodied, deeply coloured, medium to high tannins."),
    fact: l("Pepparsdoften kommer från ämnet rotundon, samma som i svartpeppar.",
      "The peppery note comes from rotundone, the same compound found in black pepper."),
  },
  {
    id: "grenache", name: "Grenache / Garnacha", match: /grenache|garnacha|cannonau/i,
    about: l("Värmeälskande druva från Spanien som är grunden i Châteauneuf-du-Pape, Priorat och många roséer.",
      "A heat-loving grape from Spain, the backbone of Châteauneuf-du-Pape, Priorat and many rosés."),
    aromas: { sv: ["jordgubbe", "hallon", "vitpeppar", "torkade örter (garrigue)", "lakrits"], en: ["strawberry", "raspberry", "white pepper", "dried herbs (garrigue)", "liquorice"] },
    structure: l("Medelfyllig till fyllig, hög alkohol, mjuka tanniner.", "Medium to full body, high alcohol, soft tannins."),
    fact: l("Gamla Grenache-stockar odlas ofta som fristående buskar (gobelet) utan spaljé.",
      "Old Grenache vines are often bush-trained (gobelet) without any trellis."),
  },
  {
    id: "tempranillo", name: "Tempranillo", match: /tempranillo|tinta de toro|tinto fino|tinta roriz|aragonez/i,
    about: l("Spaniens viktigaste druva, i Rioja och Ribera del Duero. Namnet kommer av temprano, \"tidig\", eftersom den mognar tidigt.",
      "Spain's most important grape, in Rioja and Ribera del Duero. The name comes from temprano, \"early\", as it ripens early."),
    aromas: { sv: ["körsbär", "torkade fikon", "tobak", "läder", "vanilj från ekfat"], en: ["cherry", "dried fig", "tobacco", "leather", "vanilla from oak"] },
    structure: l("Medelfyllig, medelhöga tanniner och syra.", "Medium body, medium tannins and acidity."),
    fact: l("I Rioja anger crianza, reserva och gran reserva hur länge vinet lagrats på fat och flaska.",
      "In Rioja, crianza, reserva and gran reserva tell you how long the wine has aged in barrel and bottle."),
  },
  {
    id: "sangiovese", name: "Sangiovese", match: /sangiovese|brunello|prugnolo|morellino/i,
    about: l("Toscanas själ: druvan bakom Chianti, Brunello di Montalcino och Vino Nobile. Namnet kommer troligen av sanguis Jovis, \"Jupiters blod\".",
      "The soul of Tuscany: the grape behind Chianti, Brunello di Montalcino and Vino Nobile. The name probably comes from sanguis Jovis, \"blood of Jupiter\"."),
    aromas: { sv: ["surkörsbär", "tomat", "torkade örter", "te", "läder"], en: ["sour cherry", "tomato leaf", "dried herbs", "tea", "leather"] },
    structure: l("Medelfyllig, hög syra och fasta tanniner – därför så bra till tomatbaserad mat.",
      "Medium body, high acidity and firm tannins – which is why it loves tomato-based food."),
    fact: l("Brunello är en lokal variant av Sangiovese och får säljas först den 1 januari femte året efter skörden, efter minst två år på fat.",
      "Brunello is a local strain of Sangiovese and may only be released on 1 January of the fifth year after harvest, after at least two years in wood."),
  },
  {
    id: "nebbiolo", name: "Nebbiolo", match: /nebbiolo|spanna|chiavennasca/i,
    about: l("Piemontes adelsdruva bakom Barolo och Barbaresco. Ljus i färgen men med mycket tanniner och syra.",
      "Piedmont's noble grape behind Barolo and Barbaresco. Pale in colour yet very high in tannin and acidity."),
    aromas: { sv: ["rosor", "tjära", "körsbär", "lakrits", "tryffel"], en: ["roses", "tar", "cherry", "liquorice", "truffle"] },
    structure: l("Fyllig struktur, mycket höga tanniner och syra – behöver tid.", "Powerful structure, very high tannins and acidity – needs time."),
    fact: l("Namnet kommer av nebbia, dimma, som ligger över Langhe-kullarna vid skörden i oktober.",
      "The name comes from nebbia, fog, which covers the Langhe hills at harvest in October."),
  },
  {
    id: "barbera", name: "Barbera", match: /barbera/i,
    about: l("Piemontes vardagsdruva: saftig, fruktig och med hög syra. Vanlig som Barbera d'Alba och Barbera d'Asti.",
      "Piedmont's everyday grape: juicy and fruity with high acidity, as in Barbera d'Alba and Barbera d'Asti."),
    aromas: { sv: ["mörka körsbär", "plommon", "björnbär", "örter"], en: ["black cherry", "plum", "blackberry", "herbs"] },
    structure: l("Medelfyllig, hög syra, låga tanniner.", "Medium body, high acidity, low tannins."),
    fact: l("Den höga syran gör Barbera till ett av de bästa vinerna till pizza och pasta med tomatsås.",
      "Its high acidity makes Barbera one of the best wines with pizza and tomato pasta."),
  },
  {
    id: "corvina", name: "Corvina", match: /corvin/i,
    about: l("Huvuddruvan i Valpolicella och Amarone från Veneto, oftast blandad med Corvinone och Rondinella.",
      "The main grape of Valpolicella and Amarone in the Veneto, usually blended with Corvinone and Rondinella."),
    aromas: { sv: ["körsbär", "russin", "torkade plommon", "mandel", "kakao"], en: ["cherry", "raisin", "prune", "almond", "cocoa"] },
    structure: l("Lätt som ung Valpolicella, mycket fyllig som Amarone.", "Light as young Valpolicella, very full as Amarone."),
    fact: l("Till Amarone torkas druvorna i 3–4 månader (appassimento) och förlorar en tredjedel av vikten innan de jäses.",
      "For Amarone the grapes are dried for 3–4 months (appassimento), losing a third of their weight before fermentation."),
  },
  {
    id: "malbec", name: "Malbec", match: /malbec|\bcot\b|côt/i,
    about: l("Ursprungligen från Cahors i sydvästra Frankrike, men mest känd från Mendoza i Argentina.",
      "Originally from Cahors in south-west France, but best known from Mendoza in Argentina."),
    aromas: { sv: ["björnbär", "plommon", "viol", "kakao", "rök"], en: ["blackberry", "plum", "violet", "cocoa", "smoke"] },
    structure: l("Fyllig, mörk färg, mjuka men rikliga tanniner.", "Full-bodied and dark, with soft but plentiful tannins."),
    fact: l("I Mendoza växer druvan på 800–1 500 meters höjd, där kalla nätter bevarar syran.",
      "In Mendoza it grows at 800–1,500 metres, where cold nights preserve the acidity."),
  },
  {
    id: "zinfandel", name: "Zinfandel / Primitivo", match: /zinfandel|primitivo/i,
    about: l("Samma druva under två namn: Zinfandel i Kalifornien, Primitivo i Apulien. Mognar ojämnt och ger kraftfulla, fruktiga viner.",
      "One grape, two names: Zinfandel in California, Primitivo in Puglia. It ripens unevenly and gives powerful, fruity wines."),
    aromas: { sv: ["björnbär", "russin", "sylt", "kanel", "svartpeppar"], en: ["blackberry", "raisin", "jam", "cinnamon", "black pepper"] },
    structure: l("Fyllig, ofta hög alkohol, mjuka tanniner.", "Full-bodied, often high alcohol, soft tannins."),
    fact: l("DNA-tester visade att båda är samma druva som kroatiska Crljenak Kaštelanski, med det äldsta namnet Tribidrag.",
      "DNA testing showed both are the same variety as Croatia's Crljenak Kaštelanski, whose oldest name is Tribidrag."),
  },
  {
    id: "gamay", name: "Gamay", match: /gamay/i,
    about: l("Beaujolais druva: lätt, fruktig och glad. De tio cru-byarna (t.ex. Morgon, Fleurie) ger mer struktur.",
      "The grape of Beaujolais: light, fruity and cheerful. The ten crus (e.g. Morgon, Fleurie) give more structure."),
    aromas: { sv: ["hallon", "körsbär", "banan", "viol"], en: ["raspberry", "cherry", "banana", "violet"] },
    structure: l("Lätt, låga tanniner, frisk syra – gott lätt kylt.", "Light, low tannins, fresh acidity – good slightly chilled."),
    fact: l("Banandoften kommer från kolsyrejäsning (macération carbonique), där hela druvklasar jäser.",
      "The banana note comes from carbonic maceration, where whole bunches ferment."),
  },
  {
    id: "cabernet_franc", name: "Cabernet Franc", match: /cabernet franc|bouchet/i,
    about: l("Förälder till Cabernet Sauvignon. Viktig i Saint-Émilion och i Loire (Chinon, Bourgueil).",
      "A parent of Cabernet Sauvignon. Important in Saint-Émilion and the Loire (Chinon, Bourgueil)."),
    aromas: { sv: ["hallon", "grafit", "paprika", "viol"], en: ["raspberry", "graphite", "bell pepper", "violet"] },
    structure: l("Medelfyllig, frisk syra, medelhöga tanniner.", "Medium body, fresh acidity, medium tannins."),
    fact: l("Château Cheval Blanc i Saint-Émilion har ovanligt mycket Cabernet Franc i blandningen.",
      "Château Cheval Blanc in Saint-Émilion uses an unusually high share of Cabernet Franc."),
  },
  {
    id: "carmenere", name: "Carménère", match: /carm[eé]n[eè]re/i,
    about: l("Gammal Bordeauxdruva som nästan försvann efter vinlusen och återupptäcktes i Chile 1994, där den länge förväxlats med Merlot.",
      "An old Bordeaux grape that all but vanished after phylloxera and was rediscovered in Chile in 1994, long mistaken for Merlot."),
    aromas: { sv: ["mörka bär", "grön paprika", "svartpeppar", "kakao"], en: ["dark berries", "green pepper", "black pepper", "cocoa"] },
    structure: l("Medelfyllig till fyllig, mjuka tanniner.", "Medium to full body, soft tannins."),
    fact: l("Chile har världens största planteringar av Carménère.", "Chile has the world's largest Carménère plantings."),
  },
  {
    id: "montepulciano", name: "Montepulciano", match: /(?<!nobile di )montepulciano/i,
    about: l("Druva från Abruzzo på Italiens östkust som ger mörka, mjuka och prisvärda viner.",
      "A grape from Abruzzo on Italy's east coast that gives dark, soft, good-value wines."),
    aromas: { sv: ["plommon", "körsbär", "oregano", "lakrits"], en: ["plum", "cherry", "oregano", "liquorice"] },
    structure: l("Medelfyllig till fyllig, mjuka tanniner.", "Medium to full body, soft tannins."),
    fact: l("Förväxla inte med Vino Nobile di Montepulciano – det är en stad i Toscana där vinet görs av Sangiovese.",
      "Not to be confused with Vino Nobile di Montepulciano – a Tuscan town where the wine is made from Sangiovese."),
  },
  {
    id: "nero_davola", name: "Nero d'Avola", match: /nero d.?avola/i,
    about: l("Siciliens viktigaste blå druva, uppkallad efter staden Avola på sydöstra Sicilien.",
      "Sicily's most important red grape, named after the town of Avola in the south-east."),
    aromas: { sv: ["mörka körsbär", "plommon", "lakrits", "kryddor"], en: ["black cherry", "plum", "liquorice", "spice"] },
    structure: l("Medelfyllig till fyllig, mjuka tanniner, frisk syra.", "Medium to full body, soft tannins, fresh acidity."),
    fact: l("Namnet betyder \"den svarta från Avola\".", "The name means \"the black one from Avola\"."),
  },
  {
    id: "touriga_nacional", name: "Touriga Nacional", match: /touriga/i,
    about: l("Portugals främsta blå druva, viktig i portvin och i de torra vinerna från Douro och Dão.",
      "Portugal's finest red grape, key in port and in the dry wines of the Douro and Dão."),
    aromas: { sv: ["viol", "björnbär", "bergamott", "örter"], en: ["violet", "blackberry", "bergamot", "herbs"] },
    structure: l("Fyllig, mycket färg och tanniner.", "Full-bodied, deeply coloured and tannic."),
    fact: l("Små bär och låg skörd ger koncentration men också mycket arbete för odlaren.",
      "Small berries and low yields give concentration – and a lot of work for the grower."),
  },
  {
    id: "mourvedre", name: "Mourvèdre / Monastrell", match: /mourv[eè]dre|monastrell|mataro/i,
    about: l("Senmognande druva som trivs i värme: Bandol i Provence, södra Rhône och Jumilla i Spanien.",
      "A late-ripening grape that loves heat: Bandol in Provence, the southern Rhône and Jumilla in Spain."),
    aromas: { sv: ["björnbär", "vilt", "läder", "örter"], en: ["blackberry", "game", "leather", "herbs"] },
    structure: l("Fyllig, kraftiga tanniner.", "Full-bodied with powerful tannins."),
    fact: l("Det är M:et i de klassiska GSM-blandningarna (Grenache, Syrah, Mourvèdre).",
      "It's the M in the classic GSM blends (Grenache, Syrah, Mourvèdre)."),
  },
  {
    id: "pinotage", name: "Pinotage", match: /pinotage/i,
    about: l("Sydafrikas egen druva, skapad 1925 som en korsning av Pinot Noir och Cinsault.",
      "South Africa's own grape, created in 1925 by crossing Pinot Noir with Cinsault."),
    aromas: { sv: ["mörka bär", "rök", "kaffe", "banan"], en: ["dark berries", "smoke", "coffee", "banana"] },
    structure: l("Medelfyllig till fyllig.", "Medium to full body."),
    fact: l("Cinsault kallades Hermitage i Sydafrika – därav namnet Pinot + (Hermi)tage.",
      "Cinsault was called Hermitage in South Africa – hence Pinot + (Hermi)tage."),
  },
  // Gröna druvor
  {
    id: "chardonnay", name: "Chardonnay", match: /chardonnay/i,
    about: l("Den mest mångsidiga gröna druvan: krispig och mineralisk i Chablis, fyllig och smörig med ekfat i Kalifornien.",
      "The most versatile white grape: crisp and mineral in Chablis, rich and buttery with oak in California."),
    aromas: { sv: ["citrus", "grönt äpple", "persika", "smör", "rostat bröd/vanilj (ek)"], en: ["citrus", "green apple", "peach", "butter", "toast/vanilla (oak)"] },
    structure: l("Medelfyllig till fyllig, syran beror på klimatet.", "Medium to full body; acidity depends on climate."),
    fact: l("Smörtonen kommer från malolaktisk jäsning, där skarp äppelsyra blir mjuk mjölksyra.",
      "The buttery note comes from malolactic fermentation, which turns sharp malic acid into soft lactic acid."),
  },
  {
    id: "sauvignon_blanc", name: "Sauvignon Blanc", match: /sauvignon blanc|fum[eé] blanc/i,
    about: l("Aromatisk och syrlig druva från Loire (Sancerre) och Bordeaux, världskänd genom Marlborough i Nya Zeeland.",
      "An aromatic, zesty grape from the Loire (Sancerre) and Bordeaux, made world-famous by Marlborough in New Zealand."),
    aromas: { sv: ["krusbär", "passionsfrukt", "nyklippt gräs", "fläder", "flinta"], en: ["gooseberry", "passion fruit", "cut grass", "elderflower", "flint"] },
    structure: l("Lätt till medelfyllig, hög syra.", "Light to medium body, high acidity."),
    fact: l("Den gröna doften kommer från pyraziner – samma ämnen som i grön paprika.",
      "The green aroma comes from pyrazines – the same compounds as in green bell pepper."),
  },
  {
    id: "riesling", name: "Riesling", match: /riesling/i,
    about: l("Tysklands stolthet, från benstenstorr till söt. Hög syra gör att även söta Riesling känns friska och kan lagras i decennier.",
      "Germany's pride, from bone dry to sweet. High acidity keeps even sweet Rieslings fresh and lets them age for decades."),
    aromas: { sv: ["lime", "grönt äpple", "persika", "blommor", "petroleum med ålder"], en: ["lime", "green apple", "peach", "blossom", "petrol with age"] },
    structure: l("Lätt till medelfyllig, mycket hög syra, låg alkohol.", "Light to medium body, very high acidity, low alcohol."),
    fact: l("Petroleumdoften i mogen Riesling kommer från ämnet TDN; många uppskattar den, medan andra ser den som en defekt.",
      "The petrol note in mature Riesling comes from a compound called TDN; many prize it, while others regard it as a flaw."),
  },
  {
    id: "chenin_blanc", name: "Chenin Blanc", match: /chenin|steen/i,
    about: l("Loires mångsidiga druva (Vouvray, Savennières) – torr, halvtorr, söt eller mousserande. Vanlig i Sydafrika.",
      "The Loire's versatile grape (Vouvray, Savennières) – dry, off-dry, sweet or sparkling. Widely planted in South Africa."),
    aromas: { sv: ["äpple", "päron", "honung", "kvitten", "våt ull"], en: ["apple", "pear", "honey", "quince", "wet wool"] },
    structure: l("Medelfyllig, hög syra.", "Medium body, high acidity."),
    fact: l("I Sydafrika kallades druvan länge Steen.", "In South Africa it was long known as Steen."),
  },
  {
    id: "pinot_grigio", name: "Pinot Grigio / Pinot Gris", match: /pinot gri[gs]|grauburgunder/i,
    about: l("Samma druva, två stilar: lätt och frisk som Pinot Grigio i Italien, fylligare och kryddig som Pinot Gris i Alsace.",
      "One grape, two styles: light and crisp as Italian Pinot Grigio, richer and spicier as Pinot Gris in Alsace."),
    aromas: { sv: ["päron", "citron", "mandel", "honung (Alsace)"], en: ["pear", "lemon", "almond", "honey (Alsace)"] },
    structure: l("Lätt till medelfyllig.", "Light to medium body."),
    fact: l("Skalet är grårosa – därav namnet (grigio/gris = grå).", "The skin is pinkish-grey – hence the name (grigio/gris = grey)."),
  },
  {
    id: "gewurztraminer", name: "Gewürztraminer", match: /gew[uü]rztraminer|traminer/i,
    about: l("Mycket aromatisk druva, bäst i Alsace. Ofta fyllig med låg syra och en aning sötma.",
      "A highly aromatic grape, at its best in Alsace. Often full with low acidity and a touch of sweetness."),
    aromas: { sv: ["litchi", "ros", "ingefära", "rosenlokum"], en: ["lychee", "rose", "ginger", "Turkish delight"] },
    structure: l("Fyllig, låg syra.", "Full-bodied, low acidity."),
    fact: l("Gewürz betyder krydda på tyska.", "Gewürz means spice in German."),
  },
  {
    id: "gruner_veltliner", name: "Grüner Veltliner", match: /gr[uü]ner|veltliner/i,
    about: l("Österrikes nationaldruva, bäst i Wachau, Kamptal och Kremstal.", "Austria's signature grape, at its best in the Wachau, Kamptal and Kremstal."),
    aromas: { sv: ["vitpeppar", "grönt äpple", "lime", "grönsaker"], en: ["white pepper", "green apple", "lime", "green vegetables"] },
    structure: l("Lätt till medelfyllig, frisk syra.", "Light to medium body, fresh acidity."),
    fact: l("Ett av få viner som klarar svåra matkombinationer som sparris och kronärtskocka.",
      "One of the few wines that copes with tricky food such as asparagus and artichoke."),
  },
  {
    id: "albarino", name: "Albariño", match: /albari[nñ]o|alvarinho/i,
    about: l("Druva från Rías Baixas i Galicien och Vinho Verde i Portugal, där Atlanten ger svalt och fuktigt klimat.",
      "A grape from Rías Baixas in Galicia and Vinho Verde in Portugal, where the Atlantic gives a cool, damp climate."),
    aromas: { sv: ["citron", "persika", "aprikos", "salt havsbris"], en: ["lemon", "peach", "apricot", "salty sea breeze"] },
    structure: l("Lätt till medelfyllig, hög syra.", "Light to medium body, high acidity."),
    fact: l("Vinstockarna odlas ofta på höga pergolor för att druvorna ska få luft och slippa röta.",
      "Vines are often trained on high pergolas so air can flow and keep rot away."),
  },
  {
    id: "viognier", name: "Viognier", match: /viognier/i,
    about: l("Doftrik druva från norra Rhône (Condrieu). Blandas ibland med Syrah i Côte-Rôtie.",
      "A perfumed grape from the northern Rhône (Condrieu), sometimes co-fermented with Syrah in Côte-Rôtie."),
    aromas: { sv: ["aprikos", "persika", "kaprifol", "viol"], en: ["apricot", "peach", "honeysuckle", "violet"] },
    structure: l("Fyllig, låg syra.", "Full-bodied, low acidity."),
    fact: l("På 1960-talet fanns bara några få hektar kvar – i dag odlas den över hela världen.",
      "In the 1960s only a few hectares remained – today it is grown worldwide."),
  },
  {
    id: "semillon", name: "Sémillon", match: /s[eé]millon/i,
    about: l("Bordeauxdruva för både torra viner (med Sauvignon Blanc) och söta Sauternes. Även Hunter Valley i Australien.",
      "A Bordeaux grape for dry blends (with Sauvignon Blanc) and sweet Sauternes. Also Hunter Valley in Australia."),
    aromas: { sv: ["citron", "vax", "honung", "nötter med ålder"], en: ["lemon", "wax", "honey", "nuts with age"] },
    structure: l("Medelfyllig till fyllig, lägre syra.", "Medium to full body, lower acidity."),
    fact: l("Tunt skal gör den mottaglig för ädelröta, som koncentrerar sockret i Sauternes.",
      "Thin skins make it prone to noble rot, which concentrates the sugar in Sauternes."),
  },
  {
    id: "glera", name: "Glera", match: /glera|prosecco/i,
    about: l("Druvan i prosecco, från kullarna i Veneto och Friuli.", "The grape of Prosecco, from the hills of the Veneto and Friuli."),
    aromas: { sv: ["grönt äpple", "päron", "melon", "vita blommor"], en: ["green apple", "pear", "melon", "white flowers"] },
    structure: l("Lätt, frisk, ofta med en aning sötma.", "Light and fresh, often with a hint of sweetness."),
    fact: l("Prosecco får sina bubblor i stora ståltankar (charmatmetoden) i stället för i flaskan som champagne.",
      "Prosecco gets its bubbles in large steel tanks (the Charmat method) rather than in the bottle like Champagne."),
  },
  {
    id: "muscat", name: "Muscat / Moscato", match: /muscat|moscato|moscatel/i,
    about: l("En av de äldsta druvfamiljerna, och ett av få viner som doftar som själva druvan.", "One of the oldest grape families – and one of the few wines that smell like the grape itself."),
    aromas: { sv: ["vindruva", "apelsinblom", "persika", "ros"], en: ["grape", "orange blossom", "peach", "rose"] },
    structure: l("Från lätt och söt (Moscato d'Asti) till fyllig och starkvinslik.", "From light and sweet (Moscato d'Asti) to rich and fortified."),
    fact: l("Moscato d'Asti har bara omkring 5 % alkohol eftersom jäsningen stoppas tidigt.",
      "Moscato d'Asti has only about 5% alcohol because fermentation is stopped early."),
  },
  {
    id: "verdejo", name: "Verdejo", match: /verdejo/i,
    about: l("Spansk druva från Rueda, där höga dagstemperaturer och kalla nätter ger fräscha viner.",
      "A Spanish grape from Rueda, where hot days and cold nights give fresh wines."),
    aromas: { sv: ["citrus", "fänkål", "mandel", "örter"], en: ["citrus", "fennel", "almond", "herbs"] },
    structure: l("Lätt till medelfyllig, frisk syra.", "Light to medium body, fresh acidity."),
    fact: l("Skörden sker ofta på natten för att druvorna ska hållas svala.", "Harvest often happens at night to keep the grapes cool."),
  },
];

// ---------------------------------------------------------------------------
// Vinområden – mest specifika först. Svenska namn från Systembolaget ingår.

const REGIONS: RegionEntry[] = [
  {
    id: "barolo", name: "Barolo & Barbaresco", match: /\b(barolo|barbaresco)\b/i, grapes: ["nebbiolo"],
    climate: l("Kontinentalt med kalla vintrar och varma somrar. Höstdimman (nebbia) i dalarna ger långsam mognad.",
      "Continental, with cold winters and warm summers. Autumn fog (nebbia) in the valleys slows ripening."),
    soil: l("Kalkrik märgel från havsbotten. Mjukare jord (tortonian) i La Morra ger parfym; hårdare (serravallian) i Serralunga ger kraft och struktur.",
      "Lime-rich marine marl. Softer Tortonian soils in La Morra give perfume; harder Serravallian soils in Serralunga give power and structure."),
    style: l("Barolo lagras minst 38 månader, varav 18 på fat. Vinerna är ljusa men tanninrika och utvecklas i 20+ år.",
      "Barolo ages at least 38 months, 18 in wood. The wines are pale yet tannic and develop for 20+ years."),
    fact: l("Kallas \"vinernas kung och kungarnas vin\".", "Known as \"the king of wines and the wine of kings\"."),
  },
  {
    id: "piemonte", name: l("Piemonte", "Piedmont"), match: /piemonte|piedmont|langhe|\balba\b|\basti\b|roero|gavi/i, grapes: ["nebbiolo", "barbera"],
    climate: l("Kontinentalt vid foten av Alperna (namnet betyder \"vid bergets fot\").", "Continental at the foot of the Alps (the name means \"at the foot of the mountains\")."),
    soil: l("Kalkhaltig lera och märgel på branta kullar.", "Calcareous clay and marl on steep hills."),
    style: l("Allt från fruktig Dolcetto och Barbera till lagringsvärda Nebbiolo, söt Moscato d'Asti och vit Gavi (Cortese).",
      "From fruity Dolcetto and Barbera to age-worthy Nebbiolo, sweet Moscato d'Asti and white Gavi (Cortese)."),
  },
  {
    id: "valpolicella", name: "Valpolicella & Amarone", match: /amarone|valpolicella|ripasso|recioto/i, grapes: ["corvina"],
    climate: l("Måttligt, skyddat av Alperna i norr och mildrat av Gardasjön i väster.", "Moderate, sheltered by the Alps and tempered by Lake Garda."),
    soil: l("Kalksten, lera och vulkanisk basalt på kullarna norr om Verona.", "Limestone, clay and volcanic basalt on the hills north of Verona."),
    style: l("Fyra stilar: lätt Valpolicella, Ripasso (jäst på Amarone-skal), mäktig torr Amarone och söt Recioto – de två sista av torkade druvor.",
      "Four styles: light Valpolicella, Ripasso (refermented on Amarone skins), powerful dry Amarone and sweet Recioto – the last two from dried grapes."),
    fact: l("Amarone betyder ungefär \"den stora bittra\" – enligt legenden uppstod den när en Recioto av misstag jäste torr.",
      "Amarone roughly means \"the great bitter one\" – according to legend it was born when a Recioto accidentally fermented dry."),
  },
  {
    id: "prosecco", name: "Prosecco", match: /prosecco|valdobbiadene|conegliano/i, grapes: ["glera"],
    climate: l("Svalt och fuktigt i kullarna, varmare på slätten.", "Cool and damp in the hills, warmer on the plain."),
    soil: l("Märgel och sandsten på de branta kullarna i Conegliano-Valdobbiadene (DOCG, världsarv).",
      "Marl and sandstone on the steep Conegliano-Valdobbiadene hills (DOCG, UNESCO World Heritage)."),
    style: l("Fräscht och fruktigt; drick ungt. Brut är torrast, Extra Dry har faktiskt mer sötma.",
      "Fresh and fruity; drink young. Brut is driest – Extra Dry is actually sweeter."),
  },
  {
    id: "brunello", name: "Montalcino", match: /brunello|montalcino/i, grapes: ["sangiovese"],
    climate: l("Varmare och torrare än Chianti; Monte Amiata skyddar mot oväder.", "Warmer and drier than Chianti; Monte Amiata shelters it from storms."),
    soil: l("Galestro (skiffrig lerskiffer) högre upp, mer lera och sand längre ned.", "Galestro (flaky schist) higher up, more clay and sand lower down."),
    style: l("Brunello görs av 100 % Sangiovese och får säljas tidigast femte året efter skörden. Rosso di Montalcino är den yngre lillebrodern.",
      "Brunello is 100% Sangiovese and cannot be released until the fifth year after harvest. Rosso di Montalcino is the younger sibling."),
  },
  {
    id: "chianti", name: "Chianti", match: /chianti/i, grapes: ["sangiovese"],
    climate: l("Medelhavsklimat med varma dagar och svala nätter i kullarna mellan Florens och Siena.",
      "Mediterranean, with warm days and cool nights in the hills between Florence and Siena."),
    soil: l("Galestro (skiffer) ger elegans och doft, alberese (kalksten) ger struktur.", "Galestro (schist) gives elegance and perfume, alberese (limestone) gives structure."),
    style: l("Minst 70–80 % Sangiovese. Chianti Classico med den svarta tuppen är kärnområdet; Riserva lagras längre.",
      "At least 70–80% Sangiovese. Chianti Classico, with the black rooster, is the heartland; Riserva is aged longer."),
  },
  {
    id: "toscana", name: l("Toscana", "Tuscany"), match: /toscana|tuscany|bolgheri|maremma|montepulciano|vino nobile/i, grapes: ["sangiovese"],
    climate: l("Medelhavsklimat, varmare vid kusten (Bolgheri, Maremma).", "Mediterranean, warmer along the coast (Bolgheri, Maremma)."),
    soil: l("Varierande: skiffer och kalk i inlandet, grus och sand vid kusten.", "Varied: schist and limestone inland, gravel and sand on the coast."),
    style: l("Sangiovese inåt land; vid kusten \"Supertoscanare\" med Cabernet och Merlot (t.ex. Sassicaia).",
      "Sangiovese inland; on the coast the \"Super Tuscans\" with Cabernet and Merlot (e.g. Sassicaia)."),
  },
  {
    id: "etna", name: l("Etna & Sicilien", "Etna & Sicily"), match: /\betna\b|sicili|sicily/i, grapes: ["nero_davola"],
    climate: l("Varmt medelhavsklimat; på Etna ger höjden (upp till drygt 1 000 m) svala nätter.", "Hot Mediterranean; on Etna altitude (up to just over 1,000 m) gives cool nights."),
    soil: l("På Etna svart vulkanisk jord och lava, som ger rökig mineralitet.", "On Etna black volcanic soil and lava, which give smoky minerality."),
    style: l("Nero d'Avola ger fylliga röda; Etna Rosso (Nerello Mascalese) är elegant, nästan som Pinot Noir.",
      "Nero d'Avola gives full reds; Etna Rosso (Nerello Mascalese) is elegant, almost Pinot-like."),
    fact: l("En del vinstockar på Etna överlevde vinlusen och är över 100 år gamla.", "Some vines on Etna survived phylloxera and are over 100 years old."),
  },
  {
    id: "puglia", name: l("Apulien", "Puglia"), match: /puglia|apulien|salento|manduria/i, grapes: ["zinfandel"],
    climate: l("Varmt och soligt mellan två hav – Italiens \"klack\".", "Hot and sunny between two seas – the \"heel\" of Italy."),
    soil: l("Röd lerjord (terra rossa) över kalksten.", "Red clay (terra rossa) over limestone."),
    style: l("Mogna, fruktiga och mjuka röda av Primitivo och Negroamaro.", "Ripe, fruity, soft reds from Primitivo and Negroamaro."),
  },
  {
    id: "rioja", name: "Rioja", match: /rioja/i, grapes: ["tempranillo", "grenache"],
    climate: l("Möte mellan Atlant- och medelhavsklimat, skyddat av bergskedjan Sierra de Cantabria.",
      "Where Atlantic and Mediterranean climates meet, sheltered by the Sierra de Cantabria."),
    soil: l("Kalkhaltig lera i Rioja Alta och Alavesa, alluvial lera och järnrik jord i Rioja Oriental.",
      "Calcareous clay in Rioja Alta and Alavesa, alluvial and iron-rich clay in Rioja Oriental."),
    style: l("Klassiskt lagrat på amerikansk ek (vanilj, kokos). Crianza, Reserva och Gran Reserva anger lagringstid.",
      "Traditionally aged in American oak (vanilla, coconut). Crianza, Reserva and Gran Reserva indicate ageing time."),
  },
  {
    id: "ribera", name: "Ribera del Duero & Toro", match: /ribera del duero|\btoro\b|kastilien|castilla/i, grapes: ["tempranillo"],
    climate: l("Extremt kontinentalt på 600–1 000 m höjd: heta dagar och iskalla nätter.", "Extreme continental at 600–1,000 m: hot days and icy nights."),
    soil: l("Kalk och lera med inslag av sand längs floden Duero.", "Limestone and clay with sand along the Duero river."),
    style: l("Kraftfulla, mörka Tempranillo (Tinto Fino) med mycket struktur.", "Powerful, dark Tempranillo (Tinto Fino) with lots of structure."),
    fact: l("Vega Sicilia, ett av Spaniens mest berömda viner, kommer härifrån.", "Vega Sicilia, one of Spain's most famous wines, comes from here."),
  },
  {
    id: "priorat", name: "Priorat", match: /priorat|montsant/i, grapes: ["grenache"],
    climate: l("Varmt och torrt medelhavsklimat i branta berg.", "Hot, dry Mediterranean climate in steep mountains."),
    soil: l("Llicorella – mörk, smulig skiffer med glimmer, där rötterna går djupt efter vatten.",
      "Llicorella – dark, crumbly slate with mica, where roots dig deep for water."),
    style: l("Koncentrerade, mineraliska röda av gammal Garnacha och Cariñena.", "Concentrated, mineral reds from old Garnacha and Cariñena."),
  },
  {
    id: "cava", name: "Cava & Penedès", match: /\bcava\b|pened[eè]s|katalonien|catalu/i, grapes: [],
    climate: l("Medelhavsklimat nära Barcelona.", "Mediterranean, near Barcelona."),
    soil: l("Kalk och lera.", "Limestone and clay."),
    style: l("Mousserande vin gjort som champagne (andra jäsning på flaska) av Macabeo, Xarel·lo och Parellada.",
      "Sparkling wine made like Champagne (second fermentation in bottle) from Macabeo, Xarel·lo and Parellada."),
  },
  {
    id: "jerez", name: l("Jerez (sherry)", "Jerez (sherry)"), match: /jerez|sherry|andalus|manzanilla|\bfino\b|oloroso|amontillado/i, grapes: [],
    climate: l("Varmt med svalkande havsvind (poniente) från Atlanten.", "Hot, cooled by the Atlantic poniente wind."),
    soil: l("Albariza – kritvit kalkjord som suger upp vinterregn och reflekterar solen.", "Albariza – chalk-white soil that stores winter rain and reflects the sun."),
    style: l("Starkvin som lagras i solera-system. Fino och manzanilla mognar under ett jästtäcke (flor), oloroso utan.",
      "Fortified wine aged in a solera system. Fino and manzanilla age under a yeast layer (flor), oloroso without."),
  },
  {
    id: "champagne", name: "Champagne", match: /champagne/i, grapes: ["chardonnay", "pinot_noir"],
    climate: l("Svalt och nordligt – på gränsen för var vindruvor kan mogna.", "Cool and northerly – at the limit of where grapes can ripen."),
    soil: l("Krita (belemnitkrita) som dränerar, lagrar vatten och ger den typiska friskheten. Kritan används också som källare.",
      "Chalk (belemnite) that drains, stores water and gives the typical freshness. The chalk is also carved into cellars."),
    style: l("Andra jäsningen sker i flaskan (méthode champenoise). Blanc de Blancs = bara Chardonnay; Blanc de Noirs = blå druvor.",
      "The second fermentation takes place in the bottle. Blanc de Blancs = Chardonnay only; Blanc de Noirs = black grapes."),
    fact: l("Trycket i en champagneflaska är omkring 6 bar – ungefär som i ett lastbilsdäck.", "The pressure in a Champagne bottle is about 6 bar – like a truck tyre."),
  },
  {
    id: "chablis", name: "Chablis", match: /chablis/i, grapes: ["chardonnay"],
    climate: l("Svalt kontinentalt med risk för vårfrost.", "Cool continental, with a risk of spring frost."),
    soil: l("Kimmeridge-märgel full av fossila ostronskal – ger salt, flintig mineralitet.", "Kimmeridgian marl full of fossil oyster shells – gives salty, flinty minerality."),
    style: l("Krispig, mineralisk Chardonnay, oftast utan märkbar ek. Premier Cru och Grand Cru har mer djup.",
      "Crisp, mineral Chardonnay, usually without noticeable oak. Premier and Grand Cru have more depth."),
  },
  {
    id: "beaujolais", name: "Beaujolais", match: /beaujolais|morgon|fleurie|moulin-?[aà]-?vent|brouilly|juli[eé]nas|chiroubles|r[eé]gni[eé]|ch[eé]nas|saint-amour/i, grapes: ["gamay"],
    climate: l("Mildare än resten av Bourgogne.", "Milder than the rest of Burgundy."),
    soil: l("Granit i norra delen (de tio cru-byarna), lera och kalk i söder.", "Granite in the north (the ten crus), clay and limestone in the south."),
    style: l("Lätta, fruktiga Gamay; cru-vinerna har mer struktur och kan lagras några år.", "Light, fruity Gamay; the crus have more structure and can age a few years."),
  },
  {
    id: "burgundy", name: l("Bourgogne", "Burgundy"), match: /bourgogne|burgundy|c[oô]te d.or|c[oô]te de (nuits|beaune)|gevrey|vosne|chambolle|nuits-saint|pommard|volnay|meursault|puligny|chassagne|m[aâ]con|pouilly-fuiss[eé]/i, grapes: ["pinot_noir", "chardonnay"],
    climate: l("Svalt kontinentalt; årgångarna varierar mycket.", "Cool continental; vintages vary a lot."),
    soil: l("Kalksten och märgel i en lång östsluttning. Små skillnader mellan vingårdar (climats) ger stora skillnader i vinet.",
      "Limestone and marl along a long east-facing slope. Small differences between vineyards (climats) make big differences in the wine."),
    style: l("Pinot Noir och Chardonnay. Kvalitetsstege: Bourgogne → by (t.ex. Pommard) → Premier Cru → Grand Cru.",
      "Pinot Noir and Chardonnay. Quality ladder: Bourgogne → village (e.g. Pommard) → Premier Cru → Grand Cru."),
    fact: l("Climats på Côte de Nuits och Côte de Beaune är sedan 2015 med på Unescos världsarvslista.", "The climats of the Côte de Nuits and Côte de Beaune have been a UNESCO World Heritage site since 2015."),
  },
  {
    id: "sauternes", name: "Sauternes", match: /sauternes|barsac/i, grapes: ["semillon", "sauvignon_blanc"],
    climate: l("Höstdimma från floderna Garonne och Ciron följd av soliga eftermiddagar.", "Autumn mists from the Garonne and Ciron rivers followed by sunny afternoons."),
    soil: l("Grus, sand och lera över kalksten.", "Gravel, sand and clay over limestone."),
    style: l("Söta viner av druvor angripna av ädelröta (Botrytis cinerea), plockade bär för bär i flera omgångar.",
      "Sweet wines from grapes affected by noble rot (Botrytis cinerea), picked berry by berry in several passes."),
  },
  {
    id: "bordeaux_left", name: l("Bordeaux vänstra stranden", "Bordeaux Left Bank"), match: /m[eé]doc|pauillac|margaux|saint-julien|st-julien|saint-est[eè]phe|pessac|graves/i, grapes: ["cabernet_sauvignon", "merlot"],
    climate: l("Måttligt atlantklimat, mildrat av Gironde-floden.", "Moderate Atlantic climate, tempered by the Gironde estuary."),
    soil: l("Grus och sten som håller värmen och dränerar – perfekt för senmognande Cabernet Sauvignon.",
      "Gravel and stones that hold heat and drain well – perfect for late-ripening Cabernet Sauvignon."),
    style: l("Cabernetdominerade blandningar med struktur för lång lagring. 1855 års klassificering rankar slotten (Grand Cru Classé).",
      "Cabernet-led blends built for long ageing. The 1855 Classification ranks the châteaux (Grand Cru Classé)."),
  },
  {
    id: "bordeaux_right", name: l("Bordeaux högra stranden", "Bordeaux Right Bank"), match: /saint-[eé]milion|st-[eé]milion|pomerol|fronsac|castillon/i, grapes: ["merlot", "cabernet_franc"],
    climate: l("Måttligt atlantklimat.", "Moderate Atlantic climate."),
    soil: l("Lera och kalksten, som håller kyla och fukt – Merlot trivs. Pomerol har blå lera och en järnrik alv (crasse de fer).",
      "Clay and limestone, which stay cool and moist – Merlot thrives. Pomerol has blue clay and an iron-rich subsoil (crasse de fer)."),
    style: l("Merlotdominerade, mjukare och tidigare drickbara än vänstra stranden.", "Merlot-led, softer and approachable earlier than the Left Bank."),
  },
  {
    id: "bordeaux", name: "Bordeaux", match: /bordeaux|entre-deux-mers/i, grapes: ["merlot", "cabernet_sauvignon"],
    climate: l("Måttligt atlantklimat; årgången spelar stor roll.", "Moderate Atlantic climate; vintage matters a lot."),
    soil: l("Grus på vänstra stranden, lera och kalk på högra.", "Gravel on the Left Bank, clay and limestone on the Right."),
    style: l("Blandningar av Cabernet Sauvignon, Merlot och Cabernet Franc; vita av Sauvignon Blanc och Sémillon.",
      "Blends of Cabernet Sauvignon, Merlot and Cabernet Franc; whites from Sauvignon Blanc and Sémillon."),
  },
  {
    id: "rhone_north", name: l("Norra Rhône", "Northern Rhône"), match: /c[oô]te-r[oô]tie|hermitage|crozes|saint-joseph|cornas|condrieu/i, grapes: ["syrah", "viognier"],
    climate: l("Kontinentalt med branta, solvända terrasser längs floden.", "Continental, with steep sun-facing terraces along the river."),
    soil: l("Granit och skiffer på branta sluttningar.", "Granite and schist on steep slopes."),
    style: l("Syrah som enda blå druva – peppriga, eleganta viner. Condrieu är ren Viognier.",
      "Syrah is the only red grape – peppery, elegant wines. Condrieu is pure Viognier."),
  },
  {
    id: "rhone_south", name: l("Södra Rhône", "Southern Rhône"), match: /ch[aâ]teauneuf|gigondas|vacqueyras|c[oô]tes du rh[oô]ne|rh[oô]ne|tavel|lirac/i, grapes: ["grenache", "syrah", "mourvedre"],
    climate: l("Varmt medelhavsklimat med den kalla, torra vinden mistralen.", "Warm Mediterranean climate with the cold, dry mistral wind."),
    soil: l("I Châteauneuf-du-Pape stora runda stenar (galets roulés), som sägs lagra dagens värme och släppa den på natten.",
      "In Châteauneuf-du-Pape large round stones (galets roulés), said to store the day's heat and release it at night."),
    style: l("Blandningar med Grenache i spetsen; upp till 13 druvor är tillåtna i Châteauneuf-du-Pape.",
      "Grenache-led blends; up to 13 grapes are allowed in Châteauneuf-du-Pape."),
  },
  {
    id: "loire", name: "Loire", match: /loire|sancerre|pouilly-fum|vouvray|chinon|bourgueil|savenni[eè]res|muscadet|anjou|saumur|touraine/i, grapes: ["sauvignon_blanc", "chenin_blanc", "cabernet_franc"],
    climate: l("Svalt, från Atlanten vid Muscadet till kontinentalt vid Sancerre.", "Cool, from Atlantic at Muscadet to continental at Sancerre."),
    soil: l("Flinta (silex) och kalk i Sancerre och Pouilly; tuffeau (mjuk kalksten) i Vouvray och Chinon.",
      "Flint (silex) and limestone in Sancerre and Pouilly; tuffeau (soft limestone) in Vouvray and Chinon."),
    style: l("Friska viner: Sauvignon Blanc i öst, Chenin Blanc och Cabernet Franc i mitten, Muscadet vid kusten.",
      "Fresh wines: Sauvignon Blanc in the east, Chenin Blanc and Cabernet Franc in the middle, Muscadet by the coast."),
  },
  {
    id: "alsace", name: "Alsace", match: /alsace|elsass/i, grapes: ["riesling", "gewurztraminer", "pinot_grigio"],
    climate: l("Ett av Frankrikes torraste och soligaste vinområden, i regnskugga av Vogeserna.", "One of France's driest, sunniest regions, in the rain shadow of the Vosges."),
    soil: l("Mosaik av granit, kalk, skiffer, sandsten och vulkanisk jord – 51 Grand Cru-lägen.", "A mosaic of granite, limestone, schist, sandstone and volcanic soils – 51 Grand Cru sites."),
    style: l("Viner märkta med druvnamn i höga, smala flaskor; ofta torra men ibland med restsötma.",
      "Varietally labelled wines in tall, slender bottles; often dry but sometimes off-dry."),
  },
  {
    id: "provence", name: "Provence", match: /provence|bandol|c[oô]tes de provence/i, grapes: ["grenache", "mourvedre"],
    climate: l("Varmt medelhavsklimat med mistral.", "Warm Mediterranean climate with the mistral."),
    soil: l("Kalksten i väst, skiffer och granit i öst.", "Limestone in the west, schist and granite in the east."),
    style: l("Världens rosécentrum: bleka, torra roséer. Bandol ger kraftfulla röda av Mourvèdre.",
      "The world's rosé capital: pale, dry rosés. Bandol gives powerful Mourvèdre reds."),
  },
  {
    id: "languedoc", name: "Languedoc-Roussillon", match: /languedoc|roussillon|minervois|corbi[eè]res|pic saint-loup|faug[eè]res/i, grapes: ["grenache", "syrah"],
    climate: l("Varmt och torrt medelhavsklimat.", "Hot, dry Mediterranean climate."),
    soil: l("Skiffer, kalksten och grus.", "Schist, limestone and gravel."),
    style: l("Prisvärda, solmogna blandningar av Grenache, Syrah, Carignan och Mourvèdre.", "Good-value, sun-ripened blends of Grenache, Syrah, Carignan and Mourvèdre."),
  },
  {
    id: "mosel", name: "Mosel", match: /mosel/i, grapes: ["riesling"],
    climate: l("Svalt och nordligt; branta sydsluttningar mot floden fångar solen.", "Cool and northerly; steep south-facing slopes above the river catch the sun."),
    soil: l("Blå och röd skiffer som lagrar värme och ger en rökig, mineralisk ton.", "Blue and red slate that stores heat and gives a smoky, mineral note."),
    style: l("Lätta, eleganta Riesling med låg alkohol, från torra (trocken) till söta (Auslese).",
      "Light, elegant, low-alcohol Riesling, from dry (trocken) to sweet (Auslese)."),
    fact: l("Calmont i Mosel räknas som en av Europas brantaste vingårdar.",
      "The Calmont in the Mosel is counted among Europe's steepest vineyards."),
  },
  {
    id: "germany", name: l("Tyskland", "Germany"), match: /rheingau|pfalz|rheinhessen|nahe|baden|franken|w[uü]rttemberg/i, grapes: ["riesling", "pinot_noir"],
    climate: l("Svalt; floderna mildrar klimatet.", "Cool; rivers moderate the climate."),
    soil: l("Skiffer, löss, kalk och sandsten beroende på område.", "Slate, loess, limestone and sandstone depending on the region."),
    style: l("Riesling i alla sötmagrader samt allt bättre Spätburgunder (Pinot Noir).", "Riesling at every sweetness level and increasingly fine Spätburgunder (Pinot Noir)."),
  },
  {
    id: "austria", name: l("Österrike", "Austria"), match: /wachau|kamptal|kremstal|nieder[oö]sterreich|burgenland|steiermark|[oö]sterreich|austria/i, grapes: ["gruner_veltliner", "riesling"],
    climate: l("Kontinentalt; varma dagar och svala nätter längs Donau.", "Continental; warm days and cool nights along the Danube."),
    soil: l("Löss (vindburen jord) ger fruktig Grüner; urberg (gnejs, granit) ger stram, mineralisk Riesling.",
      "Loess (wind-blown soil) gives fruity Grüner; primary rock (gneiss, granite) gives taut, mineral Riesling."),
    style: l("Torra, friska vita. Wachau märker vinerna Steinfeder, Federspiel och Smaragd efter mognad.",
      "Dry, fresh whites. The Wachau labels wines Steinfeder, Federspiel and Smaragd by ripeness."),
  },
  {
    id: "douro", name: "Douro & Porto", match: /douro|porto|\bport\b|portvin/i, grapes: ["touriga_nacional"],
    climate: l("Mycket varma, torra somrar i dalen, skyddad av bergen från Atlanten.", "Very hot, dry summers in the valley, shielded from the Atlantic by mountains."),
    soil: l("Skiffer som sprängts till terrasser för hand; rötterna går genom sprickorna efter vatten.",
      "Schist blasted into terraces by hand; roots follow the cracks down to water."),
    style: l("Portvin (jäsningen stoppas med druvsprit) och allt fler torra röda.", "Port (fermentation stopped with grape spirit) and increasingly dry reds."),
    fact: l("Douro var 1756 ett av världens första avgränsade vinområden.", "In 1756 the Douro became one of the world's first demarcated wine regions."),
  },
  {
    id: "tokaj", name: "Tokaj", match: /tokaj/i, grapes: [],
    climate: l("Kontinentalt; dimma från floderna Bodrog och Tisza ger ädelröta.", "Continental; mist from the Bodrog and Tisza rivers brings noble rot."),
    soil: l("Vulkanisk jord och löss.", "Volcanic soils and loess."),
    style: l("Tokaji Aszú är ett av världens stora söta viner, av ädelrötade Furmint-druvor.", "Tokaji Aszú is one of the world's great sweet wines, from noble-rotted Furmint."),
  },
  {
    id: "napa", name: l("Kalifornien", "California"), match: /napa|sonoma|kalifornien|california|paso robles/i, grapes: ["cabernet_sauvignon", "chardonnay"],
    climate: l("Varmt och soligt, men dimma från Stilla havet svalkar morgnarna.", "Warm and sunny, but Pacific fog cools the mornings."),
    soil: l("Vulkaniska och alluviala jordar; i Napa över 100 jordtyper.", "Volcanic and alluvial soils; Napa has over 100 soil types."),
    style: l("Mogna, fruktiga viner: kraftfull Cabernet i Napa, Pinot Noir och Chardonnay i svalare Sonoma.",
      "Ripe, fruity wines: powerful Cabernet in Napa, Pinot Noir and Chardonnay in cooler Sonoma."),
    fact: l("I \"Judgment of Paris\" 1976 slog Kalifornien franska toppviner i en blindprovning.",
      "In the 1976 \"Judgment of Paris\" Californian wines beat top French wines in a blind tasting."),
  },
  {
    id: "australia", name: l("Australien", "Australia"), match: /barossa|mclaren|coonawarra|clare|eden valley|hunter|yarra|margaret river|south australia|australi/i, grapes: ["syrah", "cabernet_sauvignon"],
    climate: l("Från hett (Barossa) till svalt (Yarra, Tasmanien).", "From hot (Barossa) to cool (Yarra, Tasmania)."),
    soil: l("Mycket gamla jordar; Coonawarra är känd för sin röda terra rossa över kalk.", "Very ancient soils; Coonawarra is famous for red terra rossa over limestone."),
    style: l("Fyllig, fruktig Shiraz i Barossa, Cabernet i Coonawarra och Margaret River, Riesling i Clare och Eden.",
      "Rich, fruity Shiraz in the Barossa, Cabernet in Coonawarra and Margaret River, Riesling in Clare and Eden."),
    fact: l("Barossa har några av världens äldsta Shiraz-stockar, planterade på 1840-talet.",
      "The Barossa has some of the world's oldest Shiraz vines, planted in the 1840s."),
  },
  {
    id: "marlborough", name: l("Nya Zeeland", "New Zealand"), match: /marlborough|central otago|hawke|martinborough|nya zeeland|new zealand/i, grapes: ["sauvignon_blanc", "pinot_noir"],
    climate: l("Svalt, soligt och blåsigt med stora skillnader mellan dag och natt.", "Cool, sunny and windy, with big day–night temperature swings."),
    soil: l("Alluvialt grus och sten från floder.", "Alluvial gravel and stones from rivers."),
    style: l("Intensivt aromatisk Sauvignon Blanc i Marlborough, Pinot Noir i Central Otago.", "Intensely aromatic Sauvignon Blanc in Marlborough, Pinot Noir in Central Otago."),
  },
  {
    id: "mendoza", name: "Argentina", match: /mendoza|uco|salta|argentin/i, grapes: ["malbec"],
    climate: l("Högt och torrt vid Anderna; intensiv sol men kalla nätter.", "High and dry by the Andes; intense sun but cold nights."),
    soil: l("Sandig, stenig jord; bevattning med smältvatten från Anderna.", "Sandy, stony soils irrigated with Andean snowmelt."),
    style: l("Mörk, fruktig Malbec; Torrontés är den aromatiska vita druvan.", "Dark, fruity Malbec; Torrontés is the aromatic white grape."),
  },
  {
    id: "chile", name: "Chile", match: /maipo|colchagua|casablanca|rapel|aconcagua|central valley|valle central|chile/i, grapes: ["cabernet_sauvignon", "carmenere"],
    climate: l("Medelhavsklimat mellan Anderna och den kalla Humboldtströmmen i Stilla havet.", "Mediterranean, between the Andes and the cold Humboldt Current."),
    soil: l("Alluvialt grus i dalarna, granit i kustbergen.", "Alluvial gravel in the valleys, granite in the coastal hills."),
    style: l("Fruktiga Cabernet och Carménère; svala Casablanca ger Sauvignon Blanc och Chardonnay.",
      "Fruity Cabernet and Carménère; cool Casablanca gives Sauvignon Blanc and Chardonnay."),
    fact: l("Chile har aldrig drabbats av vinlusen, så många stockar växer på egna rötter.",
      "Chile was never hit by phylloxera, so many vines grow on their own roots."),
  },
  {
    id: "south_africa", name: l("Sydafrika", "South Africa"), match: /stellenbosch|swartland|paarl|franschhoek|constantia|western cape|sydafrika|south africa/i, grapes: ["chenin_blanc", "pinotage"],
    climate: l("Medelhavsklimat, svalkat av två hav och vinden Cape Doctor.", "Mediterranean, cooled by two oceans and the Cape Doctor wind."),
    soil: l("Granit, sandsten och skiffer – några av världens äldsta vinjordar.", "Granite, sandstone and shale – some of the world's oldest vineyard soils."),
    style: l("Chenin Blanc, Pinotage och Bordeauxblandningar; Swartland är känt för gamla stockar och vinmakning med minimal inblandning.",
      "Chenin Blanc, Pinotage and Bordeaux blends; the Swartland is known for old vines and low-intervention winemaking."),
  },
];

// ---------------------------------------------------------------------------
// Matchning

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface GrapeKnowledge {
  name: string;
  /** true när druvan är gissad från området. */
  likely: boolean;
  about: string;
  aromas: string[];
  structure: string;
  fact: string;
  /** Källor som texten kontrollerats mot ("Läs mer"). */
  sources: string[];
}

export interface RegionKnowledge {
  name: string;
  climate: string;
  soil: string;
  style: string;
  fact: string | null;
  sources: string[];
}

export interface KnowledgeInput {
  name: string;
  color?: WineColor | null;
  grapes?: string[];
  region?: string | null;
  appellation?: string | null;
}

export interface WineKnowledge {
  grapes: GrapeKnowledge[];
  region: RegionKnowledge | null;
}

const matches = (re: RegExp, text: string) => re.test(text) || re.test(norm(text));

export function wineKnowledge(input: KnowledgeInput, locale: Locale): WineKnowledge {
  const place = [input.appellation, input.region, input.name].filter(Boolean).join(" ");
  const region = REGIONS.find((r) => matches(r.match, place)) ?? null;

  const grapeText = (input.grapes ?? []).join(", ");
  let found = GRAPES.filter((g) => matches(g.match, grapeText));
  let likely = false;
  if (!found.length) found = GRAPES.filter((g) => matches(g.match, input.name));
  if (!found.length && region) {
    // Områdets typiska druvor, filtrerade på färg där det går.
    const byColor = (g: GrapeEntry) =>
      !input.color || input.color === "sparkling" || input.color === "dessert" || input.color === "fortified" ||
      (input.color === "white") === WHITE.has(g.id);
    found = region.grapes.map((id) => GRAPES.find((g) => g.id === id)!).filter(Boolean).filter(byColor).slice(0, 1);
    likely = found.length > 0;
  }

  return {
    grapes: found.slice(0, 3).map((g) => ({
      name: g.name,
      likely,
      about: g.about[locale],
      aromas: g.aromas[locale],
      structure: g.structure[locale],
      fact: g.fact[locale],
      sources: KNOWLEDGE_SOURCES[g.id] ?? [],
    })),
    region: region && {
      name: typeof region.name === "string" ? region.name : region.name[locale],
      climate: region.climate[locale],
      soil: region.soil[locale],
      style: region.style[locale],
      fact: region.fact?.[locale] ?? null,
      sources: KNOWLEDGE_SOURCES[region.id] ?? [],
    },
  };
}

const WHITE = new Set([
  "chardonnay", "sauvignon_blanc", "riesling", "chenin_blanc", "pinot_grigio", "gewurztraminer",
  "gruner_veltliner", "albarino", "viognier", "semillon", "glera", "muscat", "verdejo",
]);

// ---------------------------------------------------------------------------
// Sommeliertips: hur man serverar, provar och kombinerar just den här typen.

export interface TipsInput {
  color?: WineColor | null;
  phase: DrinkPhase;
  decantMinutes: number;
  servingTempC: [number, number];
  /** Doft och smak att leta efter, från druvkortet. */
  aromas?: string[];
  /** Fyllig/tanninrik (t.ex. Barolo, Cabernet) – påverkar glas och mat. */
  bold?: boolean;
}

export function sommelierTips(t: TipsInput, locale: Locale): string[] {
  const sv = locale === "sv";
  const tips: string[] = [];
  const color = t.color ?? "red";

  // Glas
  if (color === "sparkling") {
    tips.push(sv ? "Glas: ett smalt tulpanglas bevarar bubblorna och samlar doften bättre än en flöjt."
      : "Glass: a narrow tulip glass keeps the bubbles and gathers aroma better than a flute.");
  } else if (color === "red") {
    tips.push(t.bold
      ? (sv ? "Glas: ett stort glas med bred kupa ger vinet luft och mjukar upp tanninerna."
        : "Glass: a large, wide-bowled glass gives the wine air and softens the tannins.")
      : (sv ? "Glas: ett rundat glas (bourgogneglas) samlar de fina dofterna." : "Glass: a rounded (Burgundy-style) glass gathers the delicate aromas."));
  } else if (color === "dessert" || color === "fortified") {
    tips.push(sv ? "Glas: ett mindre glas räcker – servera ca 6–8 cl." : "Glass: a smaller glass is enough – pour about 60–80 ml.");
  } else {
    tips.push(sv ? "Glas: ett mellanstort glas med lite smalare öppning håller vinet svalt och doften samlad."
      : "Glass: a medium glass with a slightly narrower rim keeps the wine cool and the aroma focused.");
  }

  // Temperatur
  const [lo, hi] = t.servingTempC;
  if (color === "red") {
    tips.push(sv ? `Temperatur: ${lo}–${hi} °C, alltså svalare än rumstemperatur. Ställ flaskan 15–20 min i kylen före servering.`
      : `Temperature: ${lo}–${hi} °C, cooler than room temperature. Put the bottle in the fridge for 15–20 minutes before serving.`);
  } else {
    tips.push(sv ? `Temperatur: ${lo}–${hi} °C. För kallt dämpar doften – ta ut flaskan ur kylen 10 min innan.`
      : `Temperature: ${lo}–${hi} °C. Too cold mutes the aroma – take the bottle out of the fridge 10 minutes before.`);
  }

  // Mognad och dekantering
  if (t.phase === "too_young") {
    tips.push(t.decantMinutes > 0
      ? (sv ? `Vinet är ungt: dekantera ${t.decantMinutes}–${t.decantMinutes * 2} min så öppnar det sig, eller ha tålamod och vänta några år.`
        : `The wine is young: decant for ${t.decantMinutes}–${t.decantMinutes * 2} minutes to open it up, or be patient and wait a few years.`)
      : (sv ? "Vinet är ungt – det har inte nått sin bästa tid än." : "The wine is young – it hasn't reached its best yet."));
  } else if (t.phase === "peak") {
    tips.push(sv ? "Vinet är i sin bästa tid nu – ett bra tillfälle att öppna det." : "The wine is at its peak right now – a great time to open it.");
  } else if (t.phase === "past_peak" || t.phase === "over") {
    tips.push(sv ? "Vinet är äldre: öppna snart. Dekantera försiktigt bara för att få bort bottensatsen och drick inom någon timme – gamla viner tappar doft fort."
      : "The wine is mature: open it soon. Decant gently only to remove sediment and drink within an hour – old wines fade quickly.");
  } else if (t.decantMinutes > 0) {
    tips.push(sv ? `Dekantera gärna ca ${t.decantMinutes} min för att låta doften öppna sig.` : `Consider decanting for about ${t.decantMinutes} minutes to let the aroma open up.`);
  }

  // Provning
  if (t.aromas?.length) {
    const list = t.aromas.slice(0, 4).join(", ");
    tips.push(sv ? `Prova så här: titta på färgen, snurra glaset och lukta. Leta efter ${list}. Smaka och känn efter syra, sötma, tanniner och hur länge smaken sitter kvar (eftersmaken).`
      : `Taste like this: look at the colour, swirl and smell. Look for ${list}. Then taste and notice acidity, sweetness, tannin and how long the flavour lasts (the finish).`);
  }

  // Mat
  if (color === "red" && t.bold) {
    tips.push(sv ? "Mat: tanniner mjukas upp av protein och fett – därför fungerar grillat kött och lagrad ost så bra."
      : "Food: tannins are softened by protein and fat – which is why grilled meat and aged cheese work so well.");
  } else if (color === "red") {
    tips.push(sv ? "Mat: syran i vinet ska vara minst lika hög som i maten – lätta röda passar tomat, fågel och svamp."
      : "Food: the wine should be at least as acidic as the food – lighter reds suit tomato, poultry and mushrooms.");
  } else if (color === "dessert") {
    tips.push(sv ? "Mat: vinet ska vara sötare än desserten, annars smakar det surt. Prova också till blåmögelost – salt och sött."
      : "Food: the wine should be sweeter than the dessert or it tastes sour. Also try it with blue cheese – salty meets sweet.");
  } else if (color === "sparkling") {
    tips.push(sv ? "Mat: bubblor och syra skär genom salt och friterat – prova till chips, tempura eller ostron."
      : "Food: bubbles and acidity cut through salt and fried food – try crisps, tempura or oysters.");
  } else if (color !== "fortified") {
    tips.push(sv ? "Mat: syran i vinet fräschar upp feta såser och skaldjur. Till kryddstark mat passar en aning sötma och låg alkohol."
      : "Food: the wine's acidity freshens creamy sauces and seafood. With spicy food, a touch of sweetness and lower alcohol works best.");
  }

  // Förvaring efter öppning
  tips.push(color === "sparkling"
    ? (sv ? "Öppnad flaska: förslut med en champagnekork och drick inom 1–2 dagar." : "Opened bottle: reseal with a sparkling stopper and drink within 1–2 days.")
    : color === "fortified"
      ? (sv ? "Öppnad flaska: håller i flera veckor, tack vare den högre alkoholhalten." : "Opened bottle: keeps for several weeks thanks to the higher alcohol.")
      : (sv ? "Öppnad flaska: sätt i korken och ställ i kylen (även rött) – håller 2–4 dagar." : "Opened bottle: recork and keep in the fridge (red too) – lasts 2–4 days."));

  return tips;
}
