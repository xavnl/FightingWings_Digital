# Consignes pour Claude Code — Fighting Wings Digital

L'utilisateur parle français et n'est pas développeur : expliquer simplement, en français.
L'interface de la page est en anglais (comme Tiger Wings Digital et Warbirds Digital).
**Organisation du dossier (rangée le 15/11/2026, demande de l'utilisateur)** : à la racine, seulement `CLAUDE.md` et `.claude\` ;
`Documents originaux\` = les documents du jeu, jamais modifiés (`ADC\`, `Exemples de mouvement\`, `Régles, aides\`, `Scénarios\`,
`Vassal\`) ; `Application\` = l'application (`src\`, `tools\`, `build\`, `scenarios\`, `README.md`). Dans ce fichier, les chemins
`src/`, `tools/`, `build/`, `scenarios/` sont dans `Application\`, et `ADC\`, `Vassal\`, `Exemples de mouvement\`, `Scénarios\` dans
`Documents originaux\` (les scripts les trouvent par DOCS = dossier voisin « Documents originaux »).
Modifier uniquement `Application/src/` et `Application/tools/`, puis lancer `python tools/build.py` depuis `Application\` ; ne jamais
éditer `build/` à la main.
Après chaque modification, vérifier la page dans le navigateur (config « dist » de .claude/launch.json, port 8822, sert
`Application/build/dist/` ; pas d'erreur dans la console, `window.__twdErrors` vide).
Les documents du jeu, les parties (`scenarios/`) et tout `build/` sont protégés par le droit d'auteur : jamais dans un dépôt public.
**Git (depuis le 15/11/2026)** : dépôt à la racine, branche `main`, distant https://github.com/xavnl/FightingWings_Digital.git
(lisible sans identifiant : à traiter comme public). `.gitignore` exclut `Documents originaux/`, `Application/build/`,
`Application/scenarios/`. Auteur des commits (config du dépôt) : xavnl, xavnl@users.noreply.github.com. Commit / push seulement
sur demande de l'utilisateur ; avant chaque commit, vérifier `git status` : aucun PDF, image, .vmod ni fichier de partie.

## Projet (démarré le 15/11/2026)

Table de vol numérique pour **Fighting Wings** (J.D. Webster, Clash of Arms, 3e édition), copiée de **Tiger Wings Digital**
(`C:\Users\xhard\Documents\Tiger Wings digital`, voir son CLAUDE.md : même architecture, mêmes onglets, mêmes fichiers js).
Tiger Wings est une version simplifiée de Fighting Wings : le moteur de mouvement / combat repris de TW est une BASE
PROVISOIRE, à mettre aux règles FW lot par lot. Pour l'instant, un seul scénario : **The Jolly Rogers** (1/11/1943).

Lot 1 — **Socle FW, FAIT (15/11/2026)** :
- Carte « Blue N is UP » (tools/extract_vassal.py) ; pions du module FW ; fiches ADC FW (tools/extract_adc.py) ; Minibox des
  3 avions du scénario ; scénario Jolly Rogers avec les positions du fichier de l'utilisateur ; lignes de position avec les
  codes FW (6 banks, attitudes inversées, « [loaded] ») ; caméra Nord en haut ; puissance d'urgence ; roulis gauche / droite.

Lot 2 — **Vol FW, FAIT (15/11/2026)**, voir « Mouvement FW » plus bas.

Lot 3 — **Initiative FW, FAIT (15/11/2026)**, voir « Initiative FW » plus bas.

Lot 4 — **Combat FW, FAIT (15/11/2026)**, voir « Combat FW » plus bas.

Lot 5 — **Bombes, PV, PBEM, manuels FW, FAIT (15/11/2026)**, voir « Emports, PV, PBEM, manuels » plus bas.

Suite possible (rien de décidé) : voir les « Pas fait » de chaque lot (hammerhead, volets, zone de danger du head-on, explosions,
gros canons, roquettes, tir défensif des autres bombardiers, lecture des autres fiches ADC, livret de scénarios pour les PV).

## Documents (dans le dossier du projet, jamais modifiés)

- `Exemples de mouvement\FW_Rules_master-385_Final_with_Play_Aids.pdf` (112 p., règles 3e éd. + aides de jeu). Texte lisible
  par `pdftotext -layout` (8 400 lignes). `Exemples de mouvement\PBEM move and firing formats.pdf` = le même que pour TW.
- `Scénarios\Jolly Rogers.pdf` (Whistling Death, rev. 1/27/2026). Positions de départ de l'utilisateur :
  `C:\Users\xhard\Desktop\jolly rogers starting positions.txt` (F4U-1D, 9 Val, 9 Zero, 5 Corsair ; « Moved: » / « UP: » =
  déjà bougés / à bouger ; nom du joueur entre parenthèses après l'avion, « (Tapper) »).
- `ADC\<pays>\*.pdf` : fiches FW (format « JDW Jan06 ») et d'autres séries (ASP, OTR, WD, sets « Fighting_Wings_ADC_set_* » à
  plusieurs pages) : seules A6M3, D3A2 Val, F4U-1D sont extraites et vérifiées (`python tools/extract_adc.py A6M3 D3A2 F4U-1D`).
  Sans argument, le script lit tout ce qu'il peut (40 fiches, NON vérifiées, certaines mal lues : à contrôler avant usage).
- `Vassal\fw V60b.vmod` (zip, 194 Mo, lu sans décompresser).

## Différences relevées FW / TW (lot 1)

- Carte (1.5, 3.1) : 1 hex = 100 yards (= 300 ft) ; « Blue N is UP » du module = couleur unie 10907 × 7170 + grille Vassal
  (dx 173.205, dy 200, sideways). C'est la grille de la carte Blue Sky de TW tournée : extract_vassal.py dessine l'image dans
  l'orientation TW (Nord à DROITE de l'image, build/maps/blue.jpg 3585 × 5454, numéros écrits tournés pour être lus Nord en
  haut), state.scen.north = 90 et la caméra (06-souris-camera.js, camAxes / camOff) se place au Sud du point visé.
  Vérifié : côtés d'hex du fichier (3130/3231, 4012/3911, 4216/4316, 3425/3525) = colonnes impaires décalées vers l'Est ;
  les Val volent SE de 3425 (scénario) à 2735 (fichier).
- Bank (5.1) : six angles LV, RB, IR, IV, IL, LB en cercle ; stockés 0, 1, 2, 3, -2, -1 (norm6, isInv dans 03-partie.js). Roulis
  au-delà de LB / RB vers le vol inversé permis (05d). bankDir : IV = pas de virage.
- Attitudes (6.0) : LVL, SHC, STC, VTC, SHD, STD, VTD (p.pitch -3…3) ; inversé = bank IR / IV / IL, écrit INV, ISHC, ISTC, ISHD,
  ISTD (format de l'utilisateur), « (SHD) » lu aussi. Une attitude inversée avec un bank à l'endroit met le bank à l'envers.
- Fiches FW : puissance « 8/9 » = normale / urgence (cellule {v, emer}) ; « 1/– » = pas d'urgence ; Banking FPs « 2/2 » du Zero
  = gauche / droite (bankFPs, bankFPsR) ; facteurs « 13 / 16 » = variante (gunAFalt) ; DG « (10x5)* » = chargeurs (mags) ;
  DEFENSIVE GUN COVERAGE (dgCover) ; Class « LD » (Val) ; nom de l'avion parfois sur la 2e ligne ; date « Service Entry Date ».
- Ligne de position : « D3A2 #1 (Tapper), 2735, SE, 14.0, 5.0+, LV, 0.0, LVL, [loaded] » → joueur = p.owner, charge = p.load
  ("" / "loaded" / "overloaded"), reste des crochets = p.mcarry (« MF », « SD » : sens à demander à l'utilisateur) ; suffixe
  collé à l'hex (« 2523sup ») ignoré ; titres « Moved: » / « UP: » ignorés à l'import.
- Puissance d'urgence : choix « Emergency » dans Maneuver (05d powerMax(…, emer), R.pemer) ; ses limites FW ne sont PAS
  appliquées.

## Scénario Jolly Rogers (scenarios/Jolly Rogers/Jolly Rogers.json)

- Fabriqué depuis le fichier de l'utilisateur (script ponctuel, pas dans tools/). Bleu = US Navy (F4U-1D), rouge = Japon.
  Pilotes du tableau du scénario : Val #1 regular, autres green ; Zero #1 et Corsair #1 veteran, autres regular.
  Vals : load « loaded », leader Val #1, formation « basic » du camp rouge (en attendant la formation fixe FW).
- Carte à 10 000 ft (altitudes 10.7 à 16.0) ; 30 tours ; pions Vassal A6M3 Bougainville, D3A2 Coral 1942, F4U-1D.
- La page démarre sur ce scénario quand aucune partie n'est gardée (DEFAULT = SCENARIOS[0]).

## Mouvement FW (lot 2 ; src/js/05d-manoeuvre.js moteur, 05e-onglet-mv.js onglet Maneuver)

- Plan p.mv = { power ("max" militaire | "emer" | "idle" | nombre : ≤ 1/3 de la militaire = Cruise, sinon Military), trans ("keep" |
  "pull:TT:2" | "push:NGHT:2"), oc (ft), end ("" | "or180" / "or150" / "or120"), freeH, fix ("nose" | "alt"), brakes (0, 5-10),
  rec ("STD" | "VD"), lines [{ h, v, act, rate, fac, keep }], ooc, dd, comp }. Actions : fly, rollL/R, snapL/R, turn, ngturn, slipL/R,
  skid, skidturn, exec, rv (reversal du code FATT, 0 FP, fac 4/5/6), free (facing gratuit 6.6, 0 FP). Roll terminé en vertical :
  fac = facing du vertical roll (5.3 ; 30° HFPs seuls, 60° mélange, 90° VFPs seuls ; montée = sens opposé au roulis), keep « back ».
- FATT (Flight Tables page 4) LUE EN IMAGE (pdftoppm page 104 du PDF des règles) et recopiée dans FATT.pull / FATT.push (codes texte
  parsés par parseFatt / fattRule). Cercle 0 LVL … 11 SHD dans le sens pull ; VC / VD : deux jeux de codes selon le bank ; le jeu
  « inversé » de VC (pull) / VD (pull) est la boîte grise du centre. Vérifié : un RV apparaît exactement quand le code fait changer
  de côté (à l'endroit / inversé) ; le RV inverse le bank (LB ↔ IL, RB ↔ IR, LV ↔ IV).
- Arrondis (6.1.2) : départ LVL ou shallow = VFPs au-dessous, HFPs au-dessus ; steep / vertical = l'inverse. « V+ » / « V- » = sens des
  VFPs ; sinon sens de l'attitude de fin (ou de départ si la fin est en palier). Code en deux parties : les n premiers FPs du type.
  Exception VFP (6.1.4) : p.lastV (VFPs du tour précédent, gardé à « Apply », null après RV, décrochage, sortie de vrille, correction NG).
- Sans transition : Standard Altitude Change Table ; MC (1/3+, 1/2+, 1/3+ selon l'attitude de DÉPART, appliqué au début) ; OC selon
  l'attitude de fin (± 1/4+ palier et pur vertical, sinon 1/3–, 1/2–, 1/3– dans le sens de l'attitude) ; « no OC+ », « Max OC– ».
- Puissance (4.1, 4.3.1) : pertes de puissance, puis sévère (−1/4), puis charge (2/3, 1/2) ; maxi atteignable selon le réglage
  (cruise F / MF : −1.0 HI+ / −1.5 MH− ; idle : 1/2 listée) ; excès de vitesse 2 × l'écart ; pas d'accel au-delà sans piqué.
  Accel / decel par 100 ft selon la vitesse (≥ 9.0 : 0.5 … ≤ 1.0 : 6) sur le changement NET (MC + VFPs + OC), comme en TW.
- Decel des virages et transitions réduit à grande vitesse (5.5.1, decelRate) ; crédit de transition (6.1.4) : moitié du pull (push)
  comptée en accel « tc » jusqu'au decel des virages positifs (NG). Steep / vertical tout le tour ou pull inversé ≥ 2 pas : Turn Chart à
  vitesse −1.0 (5.5). Turn Chart étendue jusqu'à 15.0+, FVT jusqu'à 15.0.
- Virages NG (5.9) : sens opposé au bank, F / L / MF, regular ou veteran, jusqu'à BT, vitesse mini du rythme au-dessus ; pas avec un
  pull. Upright : nez un pas vers la terre ou 100 ft par 30° (mv.fix) ; même correction après virage positif inversé en palier (5.5).
  Inversé tout le tour sans pull ni virage positif : effets NG (+3 decel si en palier). Effets NG → « IDLE » (moteur « No F.I. ») et
  « NGn » ; > 3 tours : critique « Power loss » à Apply. Roulis LB ↔ IL (RB ↔ IR) compté pour le virage en cours ; vers LV / IV : abandon.
- Décrochage (4.5) : % ≥ 60 vrille (mods stallMods) ; sinon nez 3 pas vers VD, bank D10, VFPs de piqué maxi, OC maxi vers le bas, joué
  par la page. Vrille : chute (n × mini listée + D5) × 100 ft ; sortie % ≤ 50 → STD ou VD (mv.rec), LV, mini ajustée + 0.5.
  Piqué dangereux % ≥ 95 (ddMods, report « DDn ») ; compressibilité % ≥ 60, sortie ≤ 50 (« COMPn ») ; overstress % ≥ 95 → D10 longeron /
  queue, black / red out % ≥ 95 par membre d'équipage (« GLOCn ») : à « Apply ». Charge p.load : mini +0.5 / +1, maxi et piqué −0.5 / −1.
- Pas fait : hammerhead, flaps, volets de piqué, turn stall (la page refuse le coup illégal), vol au hasard (GLOC : avertissement
  seulement), +1 bank / slip des avions chargés sous les ailes, MC « continu », HFP de slip perdant 100 ft.
- Vérifié le 15/11/2026 (navigateur, JS) : 23 avions sans erreur ; pull HT 2 du F4U #4 (STC → ISTC, RV après le FP 5, decel EZ à 8.0) ;
  NG HT du Zero #6 (IDLE NG1, nez SHD → STD) ; roll vertical L90 ; décrochage, vrille, sortie de vrille du Val ; piqué dangereux et
  compressibilité du F4U à 11.5 ; Apply / Undo.

## Initiative FW (lot 3 ; src/js/05g-init.js)

- Ordre (8.1, SOP des Combat Tables) : X (formations fixes, camp par camp : D10 par camp, le plus bas d'abord), H, M (idem), puis F / L
  par charge (surchargés F / L, L chargés, puis L normaux et F normaux ou chargés), non repérés en dernier ; U (décroché, en vrille,
  en compressibilité) d'abord dans son groupe (D10 par camp). Le plus BAS jet bouge d'abord ; égalités : D10 sans modificateur.
  Suiveurs juste après celui qu'ils suivent, en ordre de rang (wingmen et tailers, puis leaders subordonnés) : tailing ; membres d'une
  formation fixe (toujours) ; wingman flexible dans les paramètres si l'initiative du leader est plus haute (« follow ») ; leader
  subordonné flexible 9-9-9 par radio (un seul par camp et par tour, pas si « no radio »).
- Modificateurs : recrue −4, green −2, vétéran / as / héros +1 chacun, leader immédiat héros +1 (en formation), sévèrement endommagé −1,
  « Oil on canopy » −2, −1 par héros / as de son camp abattu (automatique), +2 victoire (state.boost, automatique au combat),
  sans radio hors formation avec plus de la moitié (arrondie au-dessus) des ennemis dans l'angle mort −2 (−1 vétéran, as, héros).
- Formations (8.5) : p.lead (leader), p.form sur les leaders (« fixed » / « flexible » ; un wingman prend le type du premier leader
  qui en a un en remontant ; flexible par défaut), p.noRadio. Fixe : wingman 2-1-3 (même hex = empilé), leader subordonné 3-3-3 (100 ft
  par hex) ; flexible : wingman 6-6-6 (même hex 300 ft / 30°), subordonné 9-9-9 (pas dans l'hex du leader) ; sans radio : 3-3-3.
  « Derrière la ligne 03 / 09 » = relèvement ≥ 90°. Limites de la formation fixe (8.5.1, fixedLimits, contrôlées par le moteur de
  mouvement) : dépassées → p.fixOut = tour + 1 (hors formation) et, pour un leader, p.form = « flexible » pour de bon.
- Tailing (8.1.1) : test simple (arrière 05-07 de la cible, cible dans l'avant 11-01, portée totale ≤ 8) ou test de déflexion (avant,
  ≤ 8, au-dessus d'une cible qui pique / au-dessous d'une qui monte, déflexion finale ≤ 30°, ou ≤ 60° si l'écart vertical dépasse
  l'horizontal de 100 ft ; tailer en palier : horizontal > vertical de 100 ft ; déflexion = fonction du combat 05p, encore TW) ;
  même hex ; VC / VD ; recrue, green (12:00 sur 6:00), formation fixe, M / H vers plus agile, ami plus léger, U, cible en vrille.
- Observation (8.1.2) : non repéré = dans les angles morts de TOUS les avions adverses (blindTo : « Rear », « Rear low »,
  « 6:00 line low », vue « Poor » aveugle sur les lignes 05 / 07, cas verticaux de la table). « If a line, only one blind » : pas fait.
- Figés au jet (state.init) : ooc, unsighted, fixed, inForm. Scénario Jolly Rogers : leaders d'après l'ordre de la liste (8.5) — Val
  #1 mène #2, #3 et les leaders #4 (#5, #6) et #7 (#8, #9), formation fixe ; Zero #1 (flexible) mène #2, #3, #4 (#5, #6), #7 (#8, #9) ;
  Corsair #1 (flexible) mène #2, #4 (le #3 manque au fichier) et #5 (#6). À FAIRE CONFIRMER par l'utilisateur.
- Vérifié (15/11/2026, navigateur) : jet, ordre (9 Val en X d'abord, en rang), tests de tailing et d'angles morts sur des cas construits.

## Combat FW (lot 4 ; src/js/05p-combat.js moteur, 05q-onglet-combat.js onglet Combat)

- Combat Tables lues : pages 1-2 en texte (pdftotext pages 91-92 du PDF), page 3 (arcs, en image : mêmes arcs qu'en TW), 4 (déflexion,
  champ vertical : identique à TW), 5 (tir défensif).
- Jet : % (dieRoll(100), 100 = « 00 » : D10 pair +130, impair −130) → Base LH Table (baseLH, symétrique) + modificateurs = LH final ;
  Combat Odds Table (HIT_ROWS) : LH plus BAS = mieux. hitChance : chance de toucher affichée. Odds : fractions vers le bas ; > 10-1 :
  −10 par odds ; < 1-6 : +5. Colonnes : tracking +1, long burst +1, demi-burst −2 (crack shot −1), beam −1, demi-point de munitions −1.
- Déflexion FW (deflection) : différence de cap puis déplacements selon les pas de nez (both level / both climbing or diving / one level /
  climber and diver), rebond à 0° et 180° ; « toward 90° » s'arrête à 90° ; 0° seulement dans l'arc sans virage (sinon 30°) ; cible en
  vrille 60° ×3 ; 12:00 sur 12:00 et ≥ 150° : facteur −1 ; gyroscope + tracking : facteur −1. Vérifié sur 4 cas du play aid.
- Modificateurs (Combat Tables page 1) : universels (NG +30, inversé +20, slip +15 / skid +30, sévère +15, sous la mini +15, snap +10,
  recrue +30, green +15, vétéran / héros −5, as / crack shot −10, blessé +20, taille −5×) ; viseur (fiche : « telescop » +15 si déflexion
  > 30°, anneau et guidon +20 sauf « backup », gyro ; viseur perdu ou huile sur la verrière +40) ; harmonisation A / B ; ailes
  déséquilibrées +15 ; LVMM +5 par pas de bank et par avion à HT+ (anneau LV RB IR IV IL LB) ; vitesses combinées > 6.0 ; rythmes G
  (F / L : TT 0, HT +10, BT +20 ; M / H : +10, +20, +30 ; utilisé ou reporté) ; excès de puissance de feu ; déflexion presque nulle −20.
- Interdits : ET, U, formation fixe au début du tour (I.fixed), cible non repérée au début du tour (I.unsighted), pilote hors de combat ;
  NG : arc sans virage, pas de tracking ni de long burst. Range 0 (10.2) ; head-on (10.3) : CRR = vitesses / 3, jet de détermination
  (≤ 90 / 80 / 70 / 50 / 30 selon la distance dans le CRR) ; zone de danger : seulement signalée. Enrayage : % brut ≥ 85 (long) / ≥ 98.
- Critiques : critCount (notes mixtes : hits distribués en cycle depuis la note la plus basse) ; zone D10 (−1 avant / −2 sur la ligne 12:00,
  +1 arrière, −1 multimoteur, crack shot ±1) ; 7 tables d'effets (critEffect) : moteur (+2 radial), carburant, cockpit (équipage :
  p.crew « WIA » / « OUT » / « KIA » ; pilote tué ou 2e blessure avec D10 ≥ 6 = abattu), ailes (bombes : D10 ≥ 6 explosion),
  équipement, commandes, + coque vide. Effets sur le vol (05d dmgOf) : longeron / queue −1.0 au piqué, ailerons « +1 Bank / Slip » sans
  snap, « Rudder out », « Elevators » (TT), « Sluggish controls » (rateCap), « Throttle: cruise max », « +1 Decel », pertes de puissance
  (> 1 pas : plus d'urgence). Deux longerons / queues : F, L détruits (trois pour M+).
- Tir défensif (defOf / defFire) : arcs des armes défensives dans DEF_ARCS (seul le D3A2, d'après la conversion du scénario Jolly Rogers :
  04-08, 6+ à 6−, ligne 6:00 plus haut seulement) ; facteur selon la ligne d'horloge de la CIBLE (plein, 2/3, 1/2, 1/3, 1/2) ; feux
  combinés : 2 hors formation, 3 en flexible, 6 en fixe, portée ≤ la plus courte + 1, une attaque par note de critique ; tireur principal ;
  modificateurs (vitesse relative, jinks de la cible, tracking contre lui −10, tir à fort angle) ; interdits (NG, snap, inversé, vertical sauf
  F / MF / D, rythme > TT, ou > HT pour F / MF / D) ; chargeurs « (10x5) » : rechargement D5 tours ; enrayage ≥ 98 → recharge D10 ≤ 7.
- Fin de tour (endChecks / doCheck) : feux mineurs / majeurs / carburant (table de progression), fuites (D10 ≤ 2, sauf cruise / idle),
  recharge, collisions (% ≥ 85 avec modificateurs ; dégâts 4D10 / 3D10 / 2D10 selon l'angle, une critique par 3 hits ; empilements sûrs
  selon la formation).
- mvT (05e) : setting, emer, anyInv (inversé à un moment), jink (facings et pas de transition à HT+).
- Pas fait : zone de danger du head-on, explosions sur les voisins, armes de 30 mm / 37 mm+, roquettes, tir défensif hors D3A2 (codes à
  lire dans les fiches), décalages verticaux des armes défensives en montée / piqué, « acquisition time », fratricide, « If a line ».
- Vérifié (15/11/2026, navigateur, JS) : LH de base, table des odds, 4 déflexions, critiques mixtes, tir du F4U sur 6 Val (enrayage,
  critiques de chaque zone, bombe qui explose), tir défensif seul et combiné (3 Val), contrôle de fuite, onglet sans erreur.

## Emports, PV, PBEM, manuels (lot 5 ; src/js/05r-emports-pv.js, 05h-mp.js, src/manuals/)

- Emport : p.bomb (texte, « » = rien ; pas dans la ligne de position). Largage (12.0) : Combat › Stores, à la Combat Phase après les tirs
  air-air ; interdit si attitude inversée en fin de mouvement ou G négatifs ce tour ; l'avion « loaded » redevient normal ; enregistré
  dans state.shots avec jett: true. Les filtres « a déjà tiré aux armes fixes » utilisent isFixedShot (ni def, ni jett).
  Critique d'aile 8 : explosion si p.bomb. Initiative : avertissement « règle spéciale 3 » (formation fixe, bombe, pas sévère).
- PV (Game › Victory points, vpOf) : HYPOTHÈSE (livret de scénarios absent) : abattu = 2e nombre « Victory Points » de la fiche,
  sévère = 1er, pilote tué = PV d'équipage 13.2 (vétéran 5, regular 3, green 1, recrue 0, +2 as / héros) ; bonus du scénario
  state.scen.bombVP { side, per } (Jolly Rogers : rouge, 1 par Val qui garde sa bombe). Parachutes non gérés.
- PBEM : les ordres de combat portent decl (armes fixes), defDecl { turn, tgt, sel { "id:DG": true } } et jett ; « Resolve declared
  attacks » : tir défensif, puis armes fixes (ordre de mouvement), puis largages. Joueurs : « Declare defensive fire », « Declare jettison » ;
  arbitre seul : « Defensive fire (%) », « Jettison stores ». Vérifié (15/11/2026) : ordres du joueur « Jap » (tir défensif du Val #1,
  largage du Val #2) importés par l'arbitre et résolus.
- Manuels (anglais) réécrits pour FW : src/manuals/player.html, referee.html (FATT, banks, initiative FW, tir défensif, largage, PV).
- Scénario : scenarios/Jolly Rogers/Jolly Rogers.json complété directement (bomb, bombVP) : le fichier de positions du Bureau n'existe
  plus, le script ponctuel du scratchpad ne peut plus le relire. Le JSON du scénario fait foi.

## Repris tel quel de Tiger Wings

Structure de la page, sauvegarde, Log, dés, carte 3D, Minibox (tout adapté au fil des lots).
Les identifiants internes gardent « TWD » / « __twd » (fonctions window.TWD_MAP, TWD_CTR, TWD_BOX écrites par build.py) ;
clés du navigateur et fichiers : « fwd-… », « Fighting Wings Digital ».
