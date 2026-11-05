/*
 * Survival-KI Studio – eingebaute Trainingsdaten
 * Fragen und Antworten auf Deutsch für die drei Modi Blackout, Survival und Apokalypse.
 * Quellen der Fakten: BBK-Ratgeber für Notfallvorsorge, DRK/ERC (Erste Hilfe),
 * BfS (Strahlenschutz, Jodtabletten), WHO/CDC (Wasseraufbereitung, Trinklösung).
 * Jede Antwort ist bewusst praxisnah: kurze Einleitung, dann Schritte oder Punkte.
 */
var SK = (globalThis.SK = globalThis.SK || {});

SK.MODES = [
  {
    id: 'blackout',
    name: 'Blackout',
    kurz: 'Stromausfall',
    text: 'Stromausfall über Stunden bis Wochen: Licht, Wärme, Wasser, Essen, Kommunikation ohne Netz.',
  },
  {
    id: 'survival',
    name: 'Survival',
    kurz: 'Wildnis',
    text: 'Überleben in der Natur: Feuer, Wasser, Unterschlupf, Orientierung, Rettung und Erste Hilfe.',
  },
  {
    id: 'apokalypse',
    name: 'Apokalypse',
    kurz: 'Großkrise',
    text: 'Große Katastrophen und Langzeit-Überleben: Evakuierung, Strahlung, Seuchen, Gemeinschaft, Selbstversorgung.',
  },
];

SK.CATEGORIES = [
  { id: 'strom', name: 'Stromausfall', modes: ['blackout'] },
  { id: 'licht', name: 'Licht & Notstrom', modes: ['blackout'] },
  { id: 'heizen', name: 'Heizen ohne Strom', modes: ['blackout'] },
  { id: 'wasser', name: 'Wasser', modes: ['blackout', 'survival', 'apokalypse'] },
  { id: 'vorrat', name: 'Vorrat & Kochen', modes: ['blackout', 'apokalypse'] },
  { id: 'kommunikation', name: 'Kommunikation & Warnung', modes: ['blackout', 'apokalypse'] },
  { id: 'erstehilfe', name: 'Erste Hilfe', modes: ['blackout', 'survival', 'apokalypse'] },
  { id: 'feuer', name: 'Feuer', modes: ['survival', 'apokalypse'] },
  { id: 'unterschlupf', name: 'Unterschlupf', modes: ['survival'] },
  { id: 'ausruestung', name: 'Ausrüstung & Knoten', modes: ['survival'] },
  { id: 'orientierung', name: 'Orientierung & Rettung', modes: ['survival'] },
  { id: 'nahrung', name: 'Nahrung aus der Natur', modes: ['survival', 'apokalypse'] },
  { id: 'wetter', name: 'Kälte, Hitze & Wetter', modes: ['survival'] },
  { id: 'evakuierung', name: 'Evakuierung & Notgepäck', modes: ['apokalypse'] },
  { id: 'abc', name: 'Strahlung, Chemie & Seuchen', modes: ['apokalypse'] },
  { id: 'katastrophen', name: 'Naturkatastrophen', modes: ['apokalypse', 'survival'] },
  { id: 'szenarien', name: 'Krisenszenarien', modes: ['apokalypse'] },
  { id: 'sicherheit', name: 'Sicherheit & Gemeinschaft', modes: ['apokalypse', 'blackout'] },
  { id: 'hygiene', name: 'Hygiene & Gesundheit', modes: ['blackout', 'apokalypse'] },
  { id: 'langzeit', name: 'Selbstversorgung', modes: ['apokalypse'] },
  { id: 'psyche', name: 'Psyche & Führung', modes: ['blackout', 'survival', 'apokalypse'] },
];

(function () {
  var list = [];
  function E(id, c, q, alt, a) {
    list.push({ id: id, c: c, q: q, alt: alt, a: a.trim() });
  }

  /* ---------------- Stromausfall ---------------- */
  E('strom-01', 'strom', 'Was mache ich in der ersten Stunde nach einem Stromausfall?',
    ['Strom ist weg, was jetzt?', 'Stromausfall was tun', 'Erste Schritte bei einem Blackout', 'Plötzlich ist überall das Licht aus, was soll ich machen?'],
    `
Ruhe bewahren und die Lage klären:
1. **Prüfen, wie groß der Ausfall ist:** Sicherungskasten checken und schauen, ob Nachbarn und Straßenlaternen auch dunkel sind. Ist nur deine Wohnung betroffen, ist es meist eine Sicherung.
2. **Licht organisieren:** Taschenlampe oder Stirnlampe statt Kerzen, das senkt die Brandgefahr.
3. **Informationen holen:** Batterie- oder Kurbelradio einschalten (Regionalsender auf UKW), die Warn-App NINA prüfen, solange das Handy Akku hat.
4. **Geräte vom Netz trennen:** Empfindliche Elektronik ausstecken, Herd und Bügeleisen ausschalten. Eine Lampe eingeschaltet lassen, damit du merkst, wann der Strom zurück ist.
5. **Kühlschrank und Gefriertruhe geschlossen halten.**
6. **Akku sparen:** Handy in den Energiesparmodus, nur kurz telefonieren.`);

  E('strom-02', 'strom', 'Wie lange bleibt Essen im Kühlschrank und in der Gefriertruhe bei Stromausfall gut?',
    ['Kühlschrank ohne Strom wie lange', 'Gefriertruhe bei Stromausfall', 'Wann muss ich Lebensmittel nach einem Stromausfall wegwerfen?'],
    `
Ein geschlossener Kühlschrank hält etwa **4 Stunden** kalt. Eine volle, geschlossene Gefriertruhe hält ungefähr **48 Stunden**, eine halb volle etwa **24 Stunden**.
- Türen so selten wie möglich öffnen.
- Zuerst die verderblichen Sachen aus dem Kühlschrank essen (Fleisch, Fisch, Milchprodukte, Reste), dann das Gefriergut, zuletzt Konserven und Trockenvorrat.
- Was länger als 2 Stunden über 4 °C warm war (Fleisch, Fisch, Milch, Eier, gekochte Speisen), lieber wegwerfen.
- Aufgetautes Gefriergut, das noch Eiskristalle hat, darf wieder eingefroren werden. Sonst zügig durchgaren und essen.
- Im Zweifel gilt: wegwerfen. Eine Lebensmittelvergiftung ist in einer Krise besonders gefährlich.`);

  E('strom-03', 'strom', 'Was funktioniert bei einem Blackout alles nicht mehr?',
    ['Welche Folgen hat ein langer Stromausfall?', 'Was fällt bei einem Blackout aus?', 'Was passiert bei einem mehrtägigen Stromausfall?'],
    `
Bei einem großflächigen Stromausfall fällt mehr aus, als viele denken:
- **Licht, Herd, Kühlschrank, Heizung:** Auch Gas- und Ölheizungen brauchen Strom für Pumpe und Steuerung.
- **Wasser:** In höheren Stockwerken und manchen Orten sinkt der Druck, wenn Pumpen ausfallen. Auch Abwasserpumpen können stoppen.
- **Handynetz und Internet:** Mobilfunkmasten haben oft nur für kurze Zeit Notstrom. Router fallen sofort aus.
- **Bezahlen:** Kartenzahlung und Geldautomaten funktionieren nicht, Bargeld wird wichtig.
- **Tankstellen:** Zapfsäulen brauchen Strom.
- **Aufzüge, elektrische Türen und Garagentore** bleiben stehen.
- **Supermärkte** schließen oft schnell, weil Kassen und Kühlung ausfallen.
Darum empfiehlt das BBK einen Vorrat für **10 Tage**.`);

  E('strom-04', 'strom', 'Woran erkenne ich, ob es ein lokaler Stromausfall oder ein großer Blackout ist?',
    ['Ist der Strom nur bei mir weg oder überall?', 'Sicherung oder Blackout erkennen', 'Wie groß ist der Stromausfall?'],
    `
So grenzt du es ein:
1. **Sicherungskasten prüfen:** Ist ein Schalter unten oder hat der FI-Schutzschalter ausgelöst? Dann liegt es an deiner Wohnung. Oft ist das zuletzt eingeschaltete Gerät schuld.
2. **Nachbarn und Straße:** Sind Treppenhaus, Nachbarhäuser und Straßenlaternen auch dunkel, ist das Netz betroffen.
3. **Radio:** Ein Batterieradio zeigt dir schnell, ob es Meldungen gibt. Die Sender berichten bei großen Ausfällen.
4. **Handy:** Wenn das Netz noch geht, die Störungsauskunft des Netzbetreibers oder die Warn-App NINA prüfen.
Ein großer Blackout betrifft ganze Regionen und dauert oft länger. Dann sofort sparsam mit Akku, Wasser und Wärme umgehen.`);

  E('strom-05', 'strom', 'Soll ich bei einem Stromausfall die Geräte ausstecken?',
    ['Geräte vom Strom trennen bei Stromausfall?', 'Überspannung wenn der Strom zurückkommt', 'Was mache ich mit meinen Elektrogeräten bei Blackout?'],
    `
Ja, empfindliche Geräte solltest du vom Netz trennen:
- Computer, Fernseher, Router und Ladegeräte ausstecken. Beim Wiedereinschalten des Netzes kann es Spannungsspitzen geben.
- **Herd, Bügeleisen und Heizlüfter ausschalten**, damit nichts unbemerkt anspringt, wenn der Strom zurückkommt. Sonst droht ein Brand.
- **Eine Lampe eingeschaltet lassen**, damit du merkst, wann der Strom wieder da ist.
- Kühlschrank und Gefriertruhe kannst du eingesteckt lassen.
- Nach der Rückkehr die Geräte nacheinander einschalten, nicht alle gleichzeitig.`);

  E('strom-06', 'strom', 'Was mache ich, wenn ich bei Stromausfall im Aufzug stecken bleibe?',
    ['Im Fahrstuhl eingesperrt bei Stromausfall', 'Aufzug bleibt stehen, was tun?', 'Eingeschlossen im Lift'],
    `
Ruhig bleiben: Im Aufzug gibt es genug Luft, und er kann nicht einfach abstürzen.
1. **Notrufknopf drücken.** Viele Aufzüge haben eine Notrufverbindung mit eigener Batterie.
2. Klappt das nicht, mit dem Handy die **112** anrufen und genau sagen, wo du bist (Adresse, Gebäude, welcher Aufzug).
3. **Nicht selbst die Tür aufhebeln oder aus der Kabine klettern.** Das ist lebensgefährlich, wenn die Kabine zwischen zwei Stockwerken steht.
4. Regelmäßig klopfen oder rufen, damit man dich hört.
5. Akku sparen, hinsetzen, ruhig atmen und warten. Die Feuerwehr befreit eingeschlossene Personen.
Tipp: Bei Blackout-Warnungen lieber die Treppe nehmen.`);

  E('strom-07', 'strom', 'Wie bereite ich mich auf einen Blackout vor?',
    ['Blackout Vorsorge', 'Checkliste für einen Stromausfall', 'Was brauche ich für einen Blackout zu Hause?'],
    `
Die wichtigsten Punkte für zu Hause:
- **Wasser:** 2 Liter pro Person und Tag, für 10 Tage also 20 Liter pro Person.
- **Essen:** Haltbare Lebensmittel, die du ohne Kühlung lagern und notfalls kalt essen kannst.
- **Licht:** Taschen- und Stirnlampen, Ersatzbatterien, ein paar Kerzen und Feuerzeug.
- **Informationen:** Batterie-, Kurbel- oder Solarradio.
- **Energie:** Geladene Powerbanks, eventuell ein kleines Solarpanel.
- **Kochen:** Campingkocher mit Kartuschen, nur bei guter Lüftung benutzen.
- **Wärme:** Warme Decken, Schlafsäcke, Wollkleidung.
- **Bargeld** in kleinen Scheinen.
- **Hausapotheke** und persönliche Medikamente für mindestens zwei Wochen.
- **Dokumente** in einer Mappe griffbereit.
- **Hygiene:** Feuchttücher, Müllbeutel, Toilettenpapier.
Mach einmal einen Probeabend ohne Strom. Dann merkst du, was fehlt.`);

  E('strom-08', 'strom', 'Wie lange dauert ein Blackout und wann kommt der Strom zurück?',
    ['Wie lange dauert ein großer Stromausfall?', 'Dauer eines Blackouts', 'Wann ist der Strom wieder da?'],
    `
Das hängt von der Ursache ab:
- **Lokale Störungen** (zum Beispiel ein beschädigtes Kabel) sind oft nach Minuten bis wenigen Stunden behoben.
- **Großflächige Blackouts** können Stunden bis mehrere Tage dauern. Das Netz muss Stück für Stück wieder hochgefahren werden.
- Auch wenn der Strom zurück ist, brauchen Wasserversorgung, Handynetze, Kassen und Tankstellen oft noch länger.
Plane deshalb mit mindestens **3 Tagen** und bereite dich nach Empfehlung des BBK auf **10 Tage** vor. Offizielle Informationen bekommst du über das Radio (UKW-Regionalsender) und die Warn-App NINA.`);

  E('strom-09', 'strom', 'Wie spare ich bei einem Stromausfall Handy-Akku?',
    ['Handy Akku sparen beim Blackout', 'Smartphone-Akku im Notfall lange halten', 'Mein Handy ist fast leer, wie spare ich Strom?'],
    `
So hält dein Handy deutlich länger:
- **Energiesparmodus** einschalten und die **Bildschirmhelligkeit** herunterdrehen.
- **WLAN, Bluetooth und GPS** ausschalten, wenn du sie nicht brauchst.
- Bei schwachem Netz sucht das Handy ständig nach Empfang und leert den Akku. Wenn kein Netz da ist: **Flugmodus** und nur ab und zu prüfen.
- Apps schließen, keine Videos, keine Spiele.
- **SMS statt Anrufe:** Kurze Nachrichten kommen bei überlasteten Netzen oft eher durch.
- Mit anderen absprechen, zu festen Zeiten kurz das Handy einzuschalten.
- Powerbanks zuerst für das wichtigste Gerät nutzen.
- Handy warm halten: Kälte lässt Akkus schneller schwach werden.`);

  E('strom-10', 'strom', 'Was sollte ich tun, wenn der Strom nach dem Blackout wiederkommt?',
    ['Strom ist wieder da, was beachten?', 'Nach dem Stromausfall Geräte wieder einschalten', 'Strom zurück, was jetzt?'],
    `
Wenn der Strom zurück ist:
1. **Geräte nacheinander einschalten**, nicht alle auf einmal.
2. **Kühlschrank und Gefriertruhe prüfen:** Aufgetautes ohne Eiskristalle nicht wieder einfrieren, verdorbene Lebensmittel wegwerfen.
3. **Heizung kontrollieren:** Manche Anlagen müssen neu gestartet werden.
4. **Uhren, Wecker und Router** neu einstellen.
5. **Vorräte auffüllen:** Batterien, Wasser, Kartuschen, Powerbanks laden.
6. **Nachbarn fragen**, besonders ältere Menschen, ob alles in Ordnung ist.
7. Informiert bleiben: Manchmal kommt es zu weiteren Abschaltungen, bis das Netz stabil ist.`);

  E('strom-11', 'strom', 'Wie helfe ich älteren Nachbarn bei einem Stromausfall?',
    ['Nachbarschaftshilfe beim Blackout', 'Hilfe für Senioren bei Stromausfall', 'Meine Oma ist allein und der Strom ist weg'],
    `
Ältere, kranke oder allein lebende Menschen brauchen jetzt Unterstützung:
- **Klingeln oder klopfen** und fragen, ob alles in Ordnung ist.
- **Medizinische Geräte:** Braucht jemand ein Sauerstoffgerät oder Heimbeatmung? Dann sofort den Pflegedienst oder bei Gefahr die **112** informieren.
- **Wärme:** Decken, warme Getränke aus der Thermoskanne und gemeinsam in einem Raum aufwärmen.
- **Medikamente:** Prüfen, ob genug da ist und ob etwas gekühlt werden muss.
- **Licht und Radio** teilen.
- Regelmäßige Besuche vereinbaren, zum Beispiel morgens und abends.
Eine gute Nachbarschaft ist in jeder Krise einer der wichtigsten Schutzfaktoren.`);

  E('strom-12', 'strom', 'Ich brauche Strom für ein medizinisches Gerät. Was tun bei einem Blackout?',
    ['Beatmungsgerät bei Stromausfall', 'Sauerstoffkonzentrator ohne Strom', 'Medizinisches Gerät und Blackout'],
    `
Hier ist Vorsorge besonders wichtig:
- **Vorher klären:** Mit Arzt, Pflegedienst oder Hersteller besprechen, wie lange der Akku hält und welche Ersatzlösung es gibt (zum Beispiel Sauerstoffflaschen statt Konzentrator).
- **Ersatzakkus** geladen halten und regelmäßig testen.
- **Notfallplan:** Wohin kannst du im Ernstfall (Klinik, Angehörige mit Notstrom)? Wer holt dich ab?
- **Bei einem Ausfall:** Wird der Akku knapp oder geht es dir schlechter, sofort die **112** anrufen.
- Den Netzbetreiber kannst du ebenfalls informieren. Eine bevorzugte Versorgung garantiert das aber nicht.
- Eine Liste mit Medikamenten, Geräten und Kontakten gut sichtbar aufbewahren.`);

  E('strom-13', 'strom', 'Warum brauche ich bei einem Blackout Bargeld?',
    ['Bargeld für den Notfall', 'Wie viel Bargeld sollte ich zu Hause haben?', 'Kartenzahlung bei Stromausfall'],
    `
Ohne Strom funktionieren **Kartenzahlung, Geldautomaten und Online-Banking** nicht. Läden, die trotzdem öffnen, nehmen oft nur Bargeld.
- Halte einen **Bargeldvorrat in kleinen Scheinen und Münzen** bereit, denn Wechselgeld ist in Krisen knapp.
- Eine Faustregel ist ein Betrag, mit dem du **ein bis zwei Wochen** das Nötigste kaufen kannst.
- **Sicher aufbewahren**, nicht alles an einem Ort und nicht darüber reden.
Bargeld ersetzt keinen Vorrat: In einem langen Blackout gibt es oft gar nichts zu kaufen.`);

  E('strom-14', 'strom', 'Kann ich bei einem Blackout noch tanken oder Auto fahren?',
    ['Tankstelle bei Stromausfall', 'Auto fahren im Blackout', 'Benzin für den Notfall lagern'],
    `
Tankstellen brauchen Strom für die Zapfsäulen. Bei einem Blackout kannst du meist **nicht tanken**.
- Halte den Tank **immer mindestens halb voll**.
- **Ampeln fallen aus:** Kreuzungen wie ohne Ampel behandeln, Verkehrszeichen und rechts vor links beachten, langsam fahren.
- **Tunnel, Parkhäuser und elektrische Schranken** können zur Falle werden.
- Unnötige Fahrten vermeiden, denn Rettungskräfte brauchen freie Straßen.
- **Kraftstoff** nur in zugelassenen Kanistern und in kleinen Mengen lagern. Für Privathaushalte gelten Grenzen, in einer Garage meist höchstens 20 Liter Benzin.
- Ein **Elektroauto** mit Steckdosen-Funktion (V2L) kann als große Powerbank dienen.`);

  /* ---------------- Licht & Notstrom ---------------- */
  E('licht-01', 'licht', 'Welche Lichtquellen sind bei einem Blackout am besten?',
    ['Licht ohne Strom', 'Beleuchtung bei Stromausfall', 'Kerzen oder Taschenlampe im Notfall?'],
    `
Am sichersten sind batteriebetriebene oder aufladbare Lampen:
- **Stirnlampe:** Beide Hände bleiben frei, ideal zum Kochen, Suchen und auf der Treppe.
- **LED-Taschenlampen** und **LED-Campinglaternen:** Sparsam und hell. Eine Laterne beleuchtet einen ganzen Raum.
- **Solar- und Kurbellampen:** Funktionieren auch ohne Batterien.
- **Knicklichter:** Für Notfälle und für Kinder sicher.
- **Kerzen und Teelichter** nur unter Aufsicht, auf feuerfester Unterlage und weit weg von Vorhängen. Nie beim Schlafen brennen lassen.
Tipp: Eine Stirnlampe, die auf eine volle Wasserflasche leuchtet, verteilt das Licht wie eine Raumlampe.`);

  E('licht-02', 'licht', 'Wie benutze ich einen Notstrom-Generator sicher?',
    ['Stromaggregat sicher betreiben', 'Generator und Kohlenmonoxid', 'Darf ein Benzin-Generator ins Haus?'],
    `
Ein Generator kann Leben retten, aber falsch benutzt auch töten:
- **Nur im Freien betreiben**, mehrere Meter vom Haus entfernt und mit dem Auspuff weg von Fenstern und Türen.
- **Niemals in Wohnung, Keller, Garage oder Zelt:** Die Abgase enthalten **Kohlenmonoxid (CO)**. Das Gas ist unsichtbar, riecht nicht und kann in Minuten tödlich sein.
- Einen **CO-Melder** im Haus installieren.
- **Nicht einfach ins Hausnetz einspeisen.** Das darf nur eine Elektrofachkraft mit einem Umschalter einrichten, sonst gefährdest du Netzmonteure und Nachbarn.
- Geräte über ein geeignetes Verlängerungskabel direkt anschließen.
- Kraftstoff sicher lagern und nur bei ausgeschaltetem, abgekühltem Gerät nachtanken.
Anzeichen einer CO-Vergiftung sind Kopfschmerzen, Schwindel, Übelkeit und Müdigkeit. Dann sofort an die frische Luft und **112** anrufen.`);

  E('licht-03', 'licht', 'Wie lade ich mein Handy ohne Strom?',
    ['Handy aufladen beim Blackout', 'Strom ohne Steckdose', 'Smartphone laden bei Stromausfall'],
    `
Es gibt mehrere Möglichkeiten:
- **Powerbank:** Am einfachsten. Eine 20.000-mAh-Powerbank lädt ein Handy etwa 3- bis 4-mal. Regelmäßig nachladen, sie entlädt sich langsam von selbst.
- **Solarpanel oder Solar-Powerbank:** Bei Sonne direkt ans Fenster oder nach draußen legen. Bei Wolken lädt es deutlich langsamer.
- **Kurbelradio mit USB:** Liefert wenig Strom, reicht aber für Notrufe.
- **Auto:** Über USB oder den Zigarettenanzünder laden. Den Motor nur im Freien laufen lassen und die Autobatterie nicht ganz leer machen.
- **Powerstation:** Großer Akku mit Steckdose, versorgt auch Lampen oder ein Radio.
Tipp: Bei einer Unwetter- oder Blackout-Warnung sofort alles voll laden.`);

  E('licht-04', 'licht', 'Was ist eine Powerstation und lohnt sie sich für den Notfall?',
    ['Powerstation für den Blackout', 'Tragbarer Stromspeicher im Notfall', 'Solargenerator kaufen?'],
    `
Eine Powerstation ist ein großer Akku mit Steckdosen, USB- und 12-Volt-Anschlüssen.
- **Kapazität in Wh (Wattstunden):** 500 Wh reichen zum Beispiel für rund 30 Handyladungen, eine LED-Lampe für viele Stunden oder ein Radio für Tage.
- **Leistung in W:** Sie zeigt, welche Geräte du anschließen kannst. Heizlüfter, Wasserkocher oder Föhn brauchen sehr viel Strom und leeren den Akku schnell.
- **Mit Solarpanel kombinieren**, dann kannst du sie tagsüber nachladen.
- Kein Abgas: Sie darf in der Wohnung stehen. Das ist der große Vorteil gegenüber einem Generator.
- Alle 3 Monate prüfen und auf etwa 80 % geladen halten.
Für Licht, Kommunikation und kleine Geräte ist eine Powerstation sehr sinnvoll.`);

  E('licht-05', 'licht', 'Wie gehe ich sicher mit Kerzen um?',
    ['Kerzen und Brandgefahr bei Stromausfall', 'Kerzenlicht sicher benutzen', 'Brand durch Kerzen vermeiden'],
    `
Bei Stromausfällen steigt die Zahl der Wohnungsbrände, oft wegen Kerzen. So bleibt es sicher:
- Kerzen auf eine **feste, nicht brennbare Unterlage** stellen, zum Beispiel einen Teller oder in ein Glas.
- **Abstand** zu Vorhängen, Möbeln, Papier und Dekoration halten.
- **Nie unbeaufsichtigt brennen lassen** und vor dem Schlafen ausmachen.
- Kinder und Haustiere fernhalten.
- **Feuerlöscher oder Löschdecke** griffbereit haben, mindestens einen Eimer Wasser.
- Rauchmelder mit Batterie funktionieren auch ohne Strom. Prüfe, ob sie gehen.
Besser: LED-Lampen und Stirnlampen als Hauptlicht, Kerzen nur ergänzend.`);

  E('licht-06', 'licht', 'Wie viele Batterien brauche ich für einen Blackout?',
    ['Batterien als Vorrat', 'Welche Batterien sollte ich lagern?', 'Batterien für den Notfall'],
    `
Plane für etwa 10 Tage:
- Schau, welche Größen deine Geräte brauchen (meist **AA** und **AAA**, manchmal **D-Zellen** für das Radio).
- Pro Lampe und Radio mindestens **zwei komplette Ersatzsätze**.
- **Lithium-Batterien** halten 10 bis 20 Jahre und funktionieren auch bei Kälte gut. Alkaline-Batterien halten etwa 5 bis 10 Jahre.
- Akkus sind gut, wenn du sie per Solar oder Powerbank nachladen kannst.
- Batterien kühl und trocken lagern und nicht im Gerät lassen, damit sie nicht auslaufen.
- Ablaufdatum notieren und einmal im Jahr kontrollieren.`);

  /* ---------------- Heizen ohne Strom ---------------- */
  E('heizen-01', 'heizen', 'Wie halte ich die Wohnung bei Stromausfall im Winter warm?',
    ['Heizung fällt im Winter aus', 'Wohnung warm halten ohne Strom', 'Heizen ohne Strom'],
    `
Ohne Strom fällt fast jede Heizung aus. So hältst du die Wärme:
1. **Einen Raum zum Wärmeraum machen:** Am besten ein kleiner Raum auf der Sonnenseite. Alle halten sich dort auf.
2. **Türen geschlossen halten**, Ritzen mit Handtüchern abdichten, Vorhänge und Rollläden nachts schließen.
3. **Fenster mit Decken oder Rettungsdecken** zusätzlich abdecken.
4. **Kurz stoßlüften** statt Fenster dauerhaft zu kippen, aber regelmäßig lüften.
5. **Warm anziehen:** Mehrere Schichten, Mütze, Wollsocken, Decken oder Schlafsack.
6. **Warme Getränke und Essen** mit dem Campingkocher bei geöffnetem Fenster zubereiten, Thermoskannen füllen.
7. **Wärmflaschen** mit heißem Wasser ins Bett.
Niemals mit einem Grill, mit Gasheizern für draußen oder offenem Feuer in der Wohnung heizen: Kohlenmonoxid-Gefahr!`);

  E('heizen-02', 'heizen', 'Darf ich bei einem Blackout mit dem Grill in der Wohnung heizen?',
    ['Grill in der Wohnung zum Heizen', 'Holzkohle drinnen benutzen', 'Gasgrill zum Heizen in der Wohnung'],
    `
**Nein, auf keinen Fall!** Holzkohlegrills, Gasgrills und Heizpilze für draußen erzeugen **Kohlenmonoxid (CO)**. Das Gas ist unsichtbar und geruchlos und kann nach kurzer Zeit zu Bewusstlosigkeit und Tod führen. Jedes Jahr sterben Menschen genau so.
- Auch glühende Holzkohle gibt weiter Kohlenmonoxid ab.
- Ein gekipptes Fenster reicht nicht aus.
- Anzeichen einer Vergiftung: Kopfschmerzen, Schwindel, Übelkeit, Verwirrtheit, Müdigkeit.
- Bei Verdacht: Sofort alle an die frische Luft bringen und **112** anrufen.
Sichere Alternativen sind ein Wärmeraum, warme Kleidung, Schlafsäcke, Wärmflaschen oder ein für Innenräume zugelassener Heizer mit Sauerstoffmangel-Sicherung, immer zusammen mit einem CO-Melder.`);

  E('heizen-03', 'heizen', 'Welche Notheizung ist für Innenräume geeignet?',
    ['Gasheizung für drinnen im Notfall', 'Sicher heizen ohne Strom', 'Katalytofen für den Notfall'],
    `
Wenn du eine Notheizung willst, achte genau auf die Zulassung:
- **Nur Geräte, die ausdrücklich für Innenräume zugelassen sind**, zum Beispiel bestimmte Katalytöfen oder Gasheizer mit **Sauerstoffmangel-Sicherung** und Kippschutz.
- **Kaminofen oder Kachelofen** sind die beste Lösung, wenn vorhanden: mit trockenem Holz und vom Schornsteinfeger geprüft.
- **Immer einen CO-Melder** im Raum nutzen.
- **Regelmäßig lüften**, auch wenn es kalt ist.
- Gasflaschen nicht im Keller lagern und auf Dichtheit prüfen.
- Nichts Brennbares in die Nähe stellen.
Heizpilze, Terrassenstrahler oder Grills gehören nie ins Haus.`);

  E('heizen-04', 'heizen', 'Wie schlafe ich warm, wenn die Heizung ausfällt?',
    ['Nachts warm bleiben ohne Heizung', 'Schlafen in einer kalten Wohnung', 'Im Winter ohne Heizung schlafen'],
    `
So bleibt es nachts warm:
- **Schlafsack oder mehrere Decken:** Unter dir ist eine Isomatte oder Decke genauso wichtig wie oben, denn Kälte kommt auch von unten.
- **Mütze und trockene Wollsocken** tragen.
- **Wärmflasche** oder eine gut verschlossene Flasche mit heißem Wasser ins Bett.
- **Zusammen schlafen:** Familie oder Mitbewohner in einem Raum, das wärmt.
- Vor dem Schlafen etwas **Warmes essen und trinken**. Kein Alkohol, er lässt dich schneller auskühlen.
- Ein kleines **Zelt im Zimmer** oder ein Deckenzelt über dem Bett hält die Körperwärme.
- Trockene Kleidung anziehen, feuchte Sachen kühlen aus.`);

  E('heizen-05', 'heizen', 'Wie verhindere ich, dass Wasserleitungen bei einem Blackout im Winter einfrieren?',
    ['Rohre frieren bei Stromausfall ein', 'Wasserleitung vor Frost schützen', 'Frostschaden im Haus vermeiden'],
    `
Bei Dauerfrost und ausgefallener Heizung können Leitungen platzen:
- Räume möglichst **nicht unter etwa 5 °C** fallen lassen.
- **Leitungen in kalten Bereichen** wie Keller und Außenwände mit Decken oder Rohrisolierung umwickeln.
- Bei längerem Ausfall und starkem Frost: **Hauptwasserhahn zudrehen** und die Leitungen entleeren, indem du die Wasserhähne öffnest. Gartenhähne sowieso entleeren.
- Vorher genug Trinkwasser abfüllen!
- Nach dem Ausfall langsam wieder aufdrehen und auf Lecks achten.`);

  /* ---------------- Wasser ---------------- */
  E('wasser-01', 'wasser', 'Wie viel Wasser brauche ich pro Person im Notfall?',
    ['Wasservorrat berechnen', 'Wie viel Trinkwasser soll ich lagern?', 'Wasser-Notvorrat für 10 Tage'],
    `
Das BBK empfiehlt **2 Liter pro Person und Tag**: 1,5 Liter zum Trinken und 0,5 Liter zum Kochen.
- Für **10 Tage** sind das **20 Liter pro Person**.
- Eine Familie mit 4 Personen braucht also 80 Liter.
- **Haustiere** nicht vergessen.
- Bei Hitze, schwerer Arbeit oder Krankheit brauchst du mehr.
- Für Waschen und Toilette zusätzlich Brauchwasser einplanen, zum Beispiel in Eimern, Kanistern oder in der Badewanne.
Am einfachsten lagerst du gekauftes Mineralwasser ohne Kohlensäure und tauschst es vor dem Ablaufdatum aus.`);

  E('wasser-02', 'wasser', 'Wie mache ich Wasser trinkbar?',
    ['Wasser aufbereiten', 'Wasser reinigen beim Survival', 'Wasser desinfizieren', 'Kann ich Bachwasser trinken?'],
    `
Die sicherste einfache Methode ist **Abkochen**:
1. Trübes Wasser zuerst absetzen lassen und durch ein sauberes Tuch oder einen Kaffeefilter gießen.
2. **Sprudelnd kochen lassen, mindestens 1 Minute.** Oberhalb von etwa 2.000 Metern Höhe 3 Minuten.
3. Abgedeckt abkühlen lassen und in saubere Behälter füllen.
Weitere Möglichkeiten:
- **Wasserfilter** (Outdoor-Filter mit 0,1 bis 0,2 Mikrometer) entfernen Bakterien und Parasiten, aber meist keine Viren und keine Chemikalien.
- **Entkeimungstabletten** mit Chlor oder Chlordioxid nach Packungsanleitung, Einwirkzeit beachten.
- **SODIS:** Klares Wasser in durchsichtigen PET-Flaschen 6 Stunden in die pralle Sonne legen, bei starker Bewölkung 2 Tage.
Gegen Chemikalien, Öl oder Giftstoffe hilft keine dieser Methoden. Solches Wasser nicht trinken.`);

  E('wasser-03', 'wasser', 'Wo finde ich in der Natur Wasser?',
    ['Wasser finden in der Wildnis', 'Wasserquelle finden beim Survival', 'Ich habe kein Wasser mehr im Wald'],
    `
Wasser findest du, wenn du die Landschaft liest:
- **Bergab gehen:** Wasser sammelt sich in Tälern, Senken und am Fuß von Hängen.
- **Grüne, dichte Pflanzen** und Schilf zeigen feuchten Boden an.
- **Tierspuren:** Wildwechsel führen oft zu Wasser.
- **Regen sammeln** mit Plane, Rettungsdecke oder Gefäßen. Regenwasser ist meist sauberer als Bachwasser.
- **Tau:** Morgens mit einem Tuch vom Gras wischen und auswringen.
- **Schnee** erst schmelzen und nicht direkt essen, das kühlt dich stark aus.
- **Quellen** sind meist sauberer als stehendes Wasser.
Wasser aus der Natur immer aufbereiten, am besten abkochen.`);

  E('wasser-04', 'wasser', 'Wie lagere ich Trinkwasser richtig?',
    ['Wasser lagern und Haltbarkeit', 'Wasserkanister lagern', 'Leitungswasser für den Notfall abfüllen'],
    `
So bleibt dein Wasservorrat sicher:
- **Gekauftes Mineralwasser** ist am einfachsten. Mindesthaltbarkeit beachten.
- **Leitungswasser** kannst du in saubere, lebensmittelechte Kanister abfüllen. Die Behälter vorher heiß ausspülen und randvoll füllen.
- Selbst abgefülltes Leitungswasser **alle 6 Monate** erneuern, bei warmer Lagerung öfter.
- **Kühl, dunkel und sauber lagern**, nicht neben Chemikalien, Benzin oder Putzmitteln.
- Behälter mit Datum beschriften.
- Bei einer Warnung zusätzlich **Badewanne, Eimer und Töpfe** füllen, als Brauchwasser für Toilette und Waschen.`);

  E('wasser-05', 'wasser', 'Kann ich Wasser aus der Heizung oder dem Warmwasserspeicher trinken?',
    ['Wasser aus dem Boiler im Notfall', 'Ist Heizungswasser trinkbar?', 'Versteckte Wasserreserven im Haus'],
    `
**Heizungswasser: nein.** Es enthält oft Zusätze, Rost und Schlamm und ist nicht trinkbar, auch nicht abgekocht.
**Warmwasserspeicher (Boiler):** Das Wasser darin ist normales Leitungswasser und kann im Notfall genutzt werden:
- Strom oder Gas zum Gerät vorher abschalten.
- Zulauf schließen, unten am Ablasshahn ablassen und oben einen Warmwasserhahn öffnen, damit Luft nachströmt.
- Vorsicht, es kann heiß sein. Am besten trotzdem abkochen.
Weitere Reserven: der Spülkasten der Toilette (nur ohne WC-Reiniger, zum Trinken abkochen) und das Wasser in den Leitungen.`);

  E('wasser-06', 'wasser', 'Wie erkenne ich, ob Wasser gefährlich ist?',
    ['Verschmutztes Wasser erkennen', 'Wann ist Wasser nicht trinkbar?', 'Ist das Wasser sauber?'],
    `
Man sieht es dem Wasser oft nicht an. Vorsicht bei:
- **Hochwasser:** Es ist fast immer mit Abwasser, Öl und Chemikalien verunreinigt. Leitungswasser nach Überschwemmungen erst trinken, wenn die Behörden es freigeben.
- **Ölfilm, chemischem Geruch, Schaum** oder ungewöhnlicher Farbe: nicht trinken, auch nicht abgekocht.
- **Stehendem Wasser** mit Algen oder Tierkadavern in der Nähe, oder unterhalb von Feldern, Fabriken und Siedlungen.
- **Abkochgebot:** Wenn die Wasserwerke es ausrufen, Leitungswasser nur abgekocht verwenden, auch zum Zähneputzen.
Klares, fließendes Wasser oberhalb von Siedlungen ist besser als stehendes. Aufbereiten musst du es trotzdem.`);

  E('wasser-07', 'wasser', 'Wie baue ich einen einfachen Wasserfilter?',
    ['Wasserfilter selber bauen', 'Notfilter aus einer Flasche', 'Wasserfilter aus Sand und Kohle'],
    `
Ein selbst gebauter Filter macht Wasser **klarer**, aber **nicht keimfrei**. Danach musst du es trotzdem abkochen oder desinfizieren.
So geht es mit einer PET-Flasche:
1. Boden abschneiden, Flasche umgedreht aufhängen, ein Stück Stoff in den Flaschenhals stecken.
2. Schichten von unten nach oben: **Stoff**, **zerstoßene Holzkohle** aus dem Feuer (ohne Asche), **feiner Sand**, **grober Sand**, **Kies**.
3. Wasser langsam oben eingießen. Das erste trübe Wasser wegschütten.
4. Das gefilterte Wasser **sprudelnd mindestens 1 Minute abkochen**.
Die Holzkohle bindet etwas Geruch und Geschmack, ersetzt aber keine Desinfektion.`);

  /* ---------------- Vorrat & Kochen ---------------- */
  E('vorrat-01', 'vorrat', 'Was gehört in einen Notvorrat für 10 Tage?',
    ['Liste für den Notvorrat', 'Lebensmittelvorrat für die Krise', 'Welche Lebensmittel soll ich bevorraten?'],
    `
Ein guter Vorrat besteht aus Dingen, die ihr sowieso esst, die lange halten und notfalls ohne Kochen gehen:
- **Getreide:** Nudeln, Reis, Haferflocken, Knäckebrot, Zwieback.
- **Konserven:** Gemüse, Hülsenfrüchte (Linsen, Bohnen, Kichererbsen), Fisch, Fleisch, Obst, Fertiggerichte.
- **Eiweiß:** Nüsse, Erdnussbutter, H-Milch, Milchpulver, Hartkäse.
- **Fette:** Öl.
- **Extras:** Honig, Zucker, Salz, Gewürze, Brühe, Schokolade, Trockenobst.
- **Getränke:** 20 Liter Wasser pro Person.
- **Besonderes:** Babynahrung, Diätprodukte, Tierfutter.
Rechne mit etwa **2.200 kcal pro Person und Tag**. Lege den Vorrat als lebenden Vorrat an: Neues nach hinten, Älteres nach vorne und verbrauchen.`);

  E('vorrat-02', 'vorrat', 'Wie koche ich ohne Strom?',
    ['Kochen bei Stromausfall', 'Essen warm machen ohne Herd', 'Campingkocher in der Wohnung benutzen'],
    `
Möglichkeiten zum Kochen ohne Strom:
- **Campingkocher mit Gaskartusche oder Spiritus:** Nur bei geöffnetem Fenster und nie unbeaufsichtigt. Genug Kartuschen lagern.
- **Gasherd:** Funktioniert oft noch, die elektrische Zündung aber nicht. Mit Feuerzeug oder Streichholz zünden.
- **Kaminofen** mit Kochplatte.
- **Grill, Feuerschale oder Hobo-Ofen** nur **im Freien**.
- **Kochkiste:** Nudeln oder Reis kurz aufkochen und dann in Decken gewickelt garziehen lassen. Das spart viel Brennstoff.
- **Kalt essen:** Viele Konserven sind schon gegart.
Brennstoff sparen: Deckel auf den Topf und kleine Portionen kochen.`);

  E('vorrat-03', 'vorrat', 'Was ist eine Kochkiste und wie spare ich damit Brennstoff?',
    ['Kochkiste bauen', 'Brennstoff sparen beim Kochen', 'Kochen mit gespeicherter Wärme'],
    `
Eine Kochkiste gart Essen mit gespeicherter Wärme. Du sparst bis zu zwei Drittel Brennstoff.
1. Essen (zum Beispiel Reis, Nudeln, Eintopf, Linsen) im Topf **kurz aufkochen**.
2. Topf mit Deckel sofort in eine **isolierte Kiste** stellen: Kühlbox, Karton oder Wäschekorb mit Decken, Kissen oder Schlafsack.
3. Rundum gut einpacken und **geschlossen lassen**.
4. Garzeit etwa verdoppeln bis verdreifachen: Reis braucht ca. 45 bis 60 Minuten, Linsen oder Eintopf 1 bis 2 Stunden.
Fleisch muss durchgegart sein. Kühlt das Essen unter etwa 60 °C ab, noch einmal kurz aufkochen.`);

  E('vorrat-04', 'vorrat', 'Welche Lebensmittel halten am längsten ohne Kühlschrank?',
    ['Lange haltbare Lebensmittel', 'Lebensmittel ohne Kühlung lagern', 'Was hält jahrelang?'],
    `
Sehr lange haltbar sind:
- **Weißer Reis, Nudeln, getrocknete Hülsenfrüchte, Haferflocken:** trocken und luftdicht gelagert oft 1 bis 2 Jahre und länger.
- **Konserven:** meist mehrere Jahre, unbeschädigt oft länger als das Mindesthaltbarkeitsdatum.
- **Honig, Zucker, Salz:** praktisch unbegrenzt.
- **Öl:** etwa 1 Jahr, kühl und dunkel.
- **Trockenobst, Nüsse:** Monate.
- **Knäckebrot, Zwieback, H-Milch, Milchpulver:** Monate bis ein Jahr.
- **Kartoffeln, Zwiebeln, Äpfel, Möhren** halten kühl, dunkel und trocken mehrere Wochen.
Aufgeblähte, rostige oder undichte Dosen niemals essen: Gefahr von Botulismus.`);

  E('vorrat-05', 'vorrat', 'Wie erkenne ich, ob eine Konserve noch gut ist?',
    ['Abgelaufene Dose essen?', 'Botulismus bei Konserven erkennen', 'Mindesthaltbarkeitsdatum überschritten'],
    `
Das Mindesthaltbarkeitsdatum ist kein Verfallsdatum. Unbeschädigte Konserven sind oft noch lange danach essbar. Prüfe so:
- **Deckel gewölbt oder aufgebläht?** Wegwerfen!
- **Zischt oder spritzt es beim Öffnen, riecht es seltsam oder ist der Inhalt schaumig?** Wegwerfen!
- **Starker Rost, Dellen an der Naht oder Undichtigkeit:** Wegwerfen.
- Bei Gläsern muss der Deckel nach innen gewölbt sein und beim Öffnen ploppen.
Grund ist das Bakteriengift **Botulinumtoxin**, das schon in kleinsten Mengen lebensgefährlich ist. Im Zweifel nicht probieren. Beim Verbrauchsdatum (zum Beispiel bei Hackfleisch) gilt: danach nicht mehr essen.`);

  E('vorrat-06', 'vorrat', 'Wie plane ich Mahlzeiten mit meinem Notvorrat?',
    ['Essen in der Krise einteilen', 'Vorrat rationieren', 'Wie teile ich mein Essen ein?'],
    `
So kommst du gut durch die Tage:
1. **Zuerst Verderbliches** aus Kühlschrank und Gefriertruhe essen, dann Frisches, zuletzt den haltbaren Vorrat.
2. **Mahlzeiten planen:** Ein warmes Essen am Tag reicht, der Rest kann kalt sein (Müsli, Knäckebrot, Konserven).
3. **Bestand aufschreiben** und abhaken, was verbraucht ist.
4. **Nicht zu früh hungern:** Mit normaler Vorsorge musst du in den ersten Tagen nicht stark rationieren. Hunger macht unkonzentriert und reizbar.
5. **Genug trinken** ist wichtiger als essen.
6. Etwas **Süßes oder ein Lieblingsessen** hebt die Stimmung, gerade bei Kindern.
Wenn eine lange Krise absehbar ist, früh und gleichmäßig einteilen.`);

  /* ---------------- Kommunikation & Warnung ---------------- */
  E('komm-01', 'kommunikation', 'Wie bekomme ich bei einem Blackout Informationen?',
    ['Nachrichten ohne Strom und Internet', 'Infos im Stromausfall bekommen', 'Welches Radio für den Notfall?'],
    `
Das wichtigste Gerät ist ein **Radio mit Batterie, Kurbel oder Solarzelle**:
- Die öffentlich-rechtlichen **Regionalsender auf UKW** senden auch bei Stromausfällen mit Notstrom und informieren über Lage, Anlaufstellen und Verhaltensregeln.
- Das **Autoradio** funktioniert auch. Den Motor aber nur im Freien laufen lassen.
- **Warn-Apps NINA und KATWARN** sowie **Cell Broadcast**, solange das Handynetz geht.
- **Sirenen:** Ein einminütiger auf- und abschwellender Heulton bedeutet Warnung. Radio einschalten.
- **Lautsprecherwagen** von Feuerwehr und Polizei.
- **Notfalltreffpunkte** in vielen Gemeinden, dort gibt es Informationen und Hilfe.
Schreibe dir die Frequenz deines Regionalsenders vorher auf.`);

  E('komm-02', 'kommunikation', 'Was bedeuten die Sirenensignale in Deutschland?',
    ['Bedeutung des Sirenen-Heultons', 'Warnton der Sirene, was tun?', 'Sirenensignal für Entwarnung'],
    `
In Deutschland gibt es einheitliche Signale:
- **Warnung:** Ein **auf- und abschwellender Heulton für 1 Minute**. Das bedeutet Gefahr: Geh in ein Gebäude, schalte Radio oder Warn-App ein und folge den Durchsagen.
- **Entwarnung:** Ein **gleichbleibender Dauerton für 1 Minute**. Die Gefahr ist vorbei.
- Manche Gemeinden alarmieren mit einem **dreimal unterbrochenen Dauerton** ihre Feuerwehr. Das ist keine Warnung für die Bevölkerung.
Am bundesweiten **Warntag** (meist im September) werden die Signale getestet.`);

  E('komm-03', 'kommunikation', 'Wie setze ich einen Notruf ab, wenn das Handynetz ausfällt?',
    ['Notruf ohne Handynetz', '112 geht nicht bei Stromausfall', 'Hilfe holen ohne Telefon'],
    `
Wenn das Telefonnetz nicht funktioniert:
- **Trotzdem 112 versuchen:** Notrufe werden über jedes verfügbare Mobilfunknetz geleitet, auch über fremde Anbieter.
- **Notfalltreffpunkte aufsuchen:** Viele Gemeinden richten bei Blackouts Anlaufstellen ein (oft Feuerwehrhäuser oder Rathäuser), von denen per Funk Hilfe gerufen werden kann.
- **Feuerwache oder Polizeiwache** direkt aufsuchen, wenn sie in der Nähe ist.
- **Nachbarn fragen:** Vielleicht hat jemand ein Funkgerät oder Satellitentelefon.
- Notfalls Passanten oder Autofahrer ansprechen.
Informiere dich vorher, wo deine nächste Anlaufstelle im Notfall ist.`);

  E('komm-04', 'kommunikation', 'Welche Funkgeräte sind für den Notfall sinnvoll?',
    ['Funkgerät für die Krise', 'PMR446 im Notfall', 'CB-Funk beim Blackout', 'Amateurfunk im Notfall'],
    `
Ohne Handynetz kann Funk die einzige Verbindung sein:
- **PMR446-Funkgeräte:** Anmelde- und gebührenfrei, einfach zu bedienen. Reichweite meist **einige hundert Meter bis wenige Kilometer**, je nach Gelände. Gut für Familie und Nachbarschaft.
- **CB-Funk:** Ebenfalls anmeldefrei, Reichweite einige Kilometer, mit Außenantenne mehr.
- **Amateurfunk:** Größte Reichweite bis weltweit, braucht aber eine **Prüfung und Lizenz**. Funkamateure unterstützen oft den Notfunk.
- **LoRa-Mesh-Geräte (zum Beispiel Meshtastic)** verschicken Textnachrichten über mehrere Geräte hinweg.
Kanäle und feste Funkzeiten vorher absprechen, Ersatzbatterien bereithalten und das Funken üben.`);

  E('komm-05', 'kommunikation', 'Wie organisiere ich die Kommunikation in meiner Familie für den Notfall?',
    ['Notfallplan für die Familie', 'Treffpunkt für den Notfall vereinbaren', 'Wie finden wir uns ohne Handy?'],
    `
Ein Familien-Notfallplan sorgt dafür, dass ihr euch findet, auch wenn Telefone ausfallen:
- **Treffpunkte festlegen:** Einen in der Nähe der Wohnung und einen außerhalb des Viertels, zum Beispiel bei Verwandten.
- **Kontaktperson außerhalb der Region:** Ferngespräche oder SMS klappen manchmal, wenn lokale Netze überlastet sind.
- **Wichtige Nummern auf Papier** im Portemonnaie und im Notfallrucksack. Ohne Akku kennt man keine Nummer auswendig.
- **Zuständigkeiten:** Wer holt die Kinder ab? Wer kümmert sich um Großeltern oder Haustiere?
- **Feste Funk- oder Telefonzeiten** absprechen, zum Beispiel jede volle Stunde 5 Minuten.
- Kindergarten und Schule nach ihrem Notfallplan fragen.
Den Plan einmal im Jahr gemeinsam durchgehen.`);

  E('komm-06', 'kommunikation', 'Was ist Cell Broadcast und wie funktioniert die Warnung aufs Handy?',
    ['Cell Broadcast Warnung', 'Warnung aufs Handy ohne App', 'Was ist die NINA-App?'],
    `
**Cell Broadcast** schickt Warnmeldungen direkt an alle Handys in einer Funkzelle, ohne App und ohne Anmeldung. In Deutschland läuft das System seit 2023.
- Die Meldung kommt mit einem lauten Warnton, je nach Warnstufe auch im Lautlos-Modus.
- In den Einstellungen deines Handys sollten die **Notfallbenachrichtigungen aktiviert** sein.
- Zusätzlich gibt es die Warn-Apps **NINA** (vom BBK) und **KATWARN** mit Hintergrundinfos und Verhaltenstipps.
- Bei einem großen Blackout kann das Mobilfunknetz nach einiger Zeit ausfallen. Dann ist das **Radio** die wichtigste Informationsquelle.
Testen kannst du alles am bundesweiten Warntag.`);

  /* ---------------- Erste Hilfe ---------------- */
  E('hilfe-01', 'erstehilfe', 'Wie stoppe ich eine starke Blutung?',
    ['Blutung stillen', 'Eine Wunde blutet stark', 'Druckverband anlegen'],
    `
Bei einer starken Blutung zählt jede Minute:
1. **Notruf 112** absetzen oder absetzen lassen.
2. Wenn möglich **Einmalhandschuhe** anziehen.
3. **Fest auf die Wunde drücken**: mit einer Kompresse, einem sauberen Tuch oder notfalls der Hand.
4. Den verletzten Arm oder das Bein **hochlagern** und die Person hinlegen.
5. **Druckverband anlegen:** Kompresse auf die Wunde, ein festes Polster (zum Beispiel eine ungeöffnete Mullbinde) darauf und fest umwickeln.
6. Blutet es durch, ein zweites Polster darüber und noch fester wickeln.
7. Bei einer lebensbedrohlichen Blutung an Arm oder Bein, die sich nicht stoppen lässt, kann ein **Tourniquet** nötig sein. Das sollte man in einem Erste-Hilfe-Kurs gelernt haben.
8. Person zudecken, beruhigen und auf Schockzeichen achten.`);

  E('hilfe-02', 'erstehilfe', 'Wie erkenne und behandle ich einen Schock?',
    ['Schock Erste Hilfe', 'Schocklage', 'Anzeichen für einen Kreislaufschock'],
    `
Ein Schock bedeutet, dass der Körper nicht mehr genug durchblutet wird. Das ist lebensgefährlich.
**Anzeichen:** blasse, kalte, feuchte Haut, schneller schwacher Puls, Unruhe oder Angst, Frieren, Zittern, später Teilnahmslosigkeit.
**Was tun:**
1. **Notruf 112.**
2. Ursache behandeln, wenn möglich (zum Beispiel Blutung stoppen).
3. Person **hinlegen** und die **Beine etwas anheben**, aber nur ohne Verletzungen an Beinen, Becken, Wirbelsäule oder Kopf.
4. **Zudecken** und vor Kälte schützen, auch von unten.
5. **Beruhigen** und nicht allein lassen.
6. **Nichts zu trinken oder essen geben.**
7. Atmung und Bewusstsein ständig überwachen.`);

  E('hilfe-03', 'erstehilfe', 'Wie funktioniert die Herz-Lungen-Wiederbelebung?',
    ['Anleitung zur Wiederbelebung', 'Herzdruckmassage', 'Eine Person atmet nicht, was tun?', 'Jemand ist bewusstlos und atmet nicht mehr', 'Reanimation'],
    `
Wenn jemand nicht reagiert und nicht normal atmet:
1. **Laut ansprechen und anfassen.** Keine Reaktion: um Hilfe rufen.
2. **Atmung prüfen:** Kopf nach hinten neigen, Kinn anheben, höchstens 10 Sekunden sehen, hören, fühlen.
3. Keine normale Atmung: **112 anrufen** (Lautsprecher an) und einen **Defibrillator (AED)** holen lassen.
4. **Herzdruckmassage:** Handballen in die Mitte des Brustkorbs, Arme gestreckt, **5 bis 6 cm tief** und **100 bis 120 Mal pro Minute** drücken.
5. Wenn du es kannst: nach 30 Drückern 2-mal beatmen. Sonst einfach **ununterbrochen drücken**.
6. Sobald der AED da ist: einschalten und den Sprachanweisungen folgen.
7. Weitermachen, bis der Rettungsdienst übernimmt oder die Person wieder normal atmet.
Merksatz: **Prüfen, Rufen, Drücken.** Falsch machen kannst du nur, wenn du nichts tust.`);

  E('hilfe-04', 'erstehilfe', 'Wann und wie bringe ich jemanden in die stabile Seitenlage?',
    ['Stabile Seitenlage Anleitung', 'Bewusstlos, aber atmet', 'Eine Person ist bewusstlos, was tun?'],
    `
Die stabile Seitenlage ist für Menschen, die **bewusstlos sind, aber normal atmen**. Sie verhindert, dass Erbrochenes oder die Zunge die Atemwege blockieren.
1. Neben die Person knien, den **nahen Arm angewinkelt nach oben** legen.
2. Den **fernen Arm** greifen und die Hand an die nahe Wange legen, festhalten.
3. Das **ferne Bein** am Knie anwinkeln und die Person daran zu dir herüberrollen.
4. Das obere Bein so ausrichten, dass Hüfte und Knie im rechten Winkel liegen.
5. **Kopf nach hinten neigen**, den Mund leicht öffnen und nach unten zeigen lassen.
6. **112 anrufen**, zudecken und die **Atmung ständig prüfen**.
Hört die Person auf, normal zu atmen: sofort mit der Wiederbelebung beginnen.`);

  E('hilfe-05', 'erstehilfe', 'Wie behandle ich eine Verbrennung?',
    ['Verbrennung Erste Hilfe', 'Brandwunde kühlen', 'Ich habe mich verbrannt, was tun?'],
    `
Erste Hilfe bei Verbrennungen:
1. **Brandursache stoppen:** Brennende Kleidung mit einer Decke ersticken oder die Person auf dem Boden rollen lassen.
2. **Kleine Verbrennungen kühlen:** mit **handwarmem**, fließendem Wasser etwa **10 Minuten**, bis der Schmerz nachlässt. Kein Eis und kein eiskaltes Wasser.
3. **Großflächige Verbrennungen nicht kühlen**, sonst droht Unterkühlung. Sofort **112** anrufen.
4. Schmuck und Kleidung vorsichtig entfernen, aber nichts abreißen, was an der Haut klebt.
5. Wunde **locker und keimfrei abdecken**, zum Beispiel mit einem Brandwunden-Verbandtuch.
6. **Keine Hausmittel** wie Mehl, Butter, Öl oder Zahnpasta.
7. Brandblasen nicht aufstechen.
Bei Verbrennungen im Gesicht, an Händen oder Genitalien, bei Kindern oder großen Flächen: immer ärztliche Hilfe oder 112.`);

  E('hilfe-06', 'erstehilfe', 'Was mache ich bei einem Knochenbruch, wenn kein Arzt erreichbar ist?',
    ['Knochenbruch schienen', 'Knochenbruch in der Wildnis', 'Mein Arm ist gebrochen, was tun?'],
    `
Zuerst wenn möglich **112** anrufen. Ist keine Hilfe erreichbar:
1. **Ruhig stellen** in der Lage, in der es am wenigsten schmerzt. Nicht versuchen, den Bruch einzurichten.
2. **Schienen** mit Stöcken, Brettern, zusammengerollter Zeitung oder Isomatte. Die Schiene muss die **Gelenke ober- und unterhalb** des Bruchs einschließen. Gut polstern und mit Tüchern fixieren, nicht abschnüren.
3. Einen Arm mit einem **Dreiecktuch** oder einer Jacke als Schlinge am Körper fixieren.
4. **Offene Brüche:** Wunde keimfrei abdecken und Blutung stoppen, ohne in die Wunde zu drücken.
5. **Durchblutung prüfen:** Finger oder Zehen müssen warm und rosig bleiben. Werden sie kalt oder blau, die Fixierung lockern.
6. **Kühlen** (nicht direkt mit Eis auf der Haut) hilft gegen Schwellung und Schmerz.
7. Person warm halten und auf Schockzeichen achten.`);

  E('hilfe-07', 'erstehilfe', 'Was gehört in eine Notfall-Hausapotheke?',
    ['Liste für die Hausapotheke', 'Erste-Hilfe-Set für die Krise', 'Medikamente als Notvorrat'],
    `
Eine gute Notfall-Apotheke enthält:
- **Persönliche Medikamente** für mindestens 2 Wochen und eine Liste mit Dosierung.
- **Verbandsmaterial:** Pflaster, Mullbinden, sterile Kompressen, Verbandpäckchen, Dreiecktuch.
- **Einmalhandschuhe**, Schere, Pinzette, Zeckenzange, Fieberthermometer, Rettungsdecke.
- **Desinfektion** für Wunden und Hände.
- **Schmerz- und Fiebermittel** wie Paracetamol oder Ibuprofen.
- **Mittel gegen Durchfall** und **Elektrolyt-Pulver**.
- Mittel gegen Erkältung, Allergien und Insektenstiche, Sonnenschutz.
- Einen **Erste-Hilfe-Ratgeber** auf Papier.
Ablaufdaten regelmäßig prüfen und mit Ärztin oder Apotheker klären, was für deine Familie sonst noch sinnvoll ist.`);

  E('hilfe-08', 'erstehilfe', 'Wie versorge ich eine Wunde, wenn kein Arzt erreichbar ist?',
    ['Wunde reinigen beim Survival', 'Schnittwunde versorgen', 'Wundinfektion vermeiden'],
    `
So beugst du einer Infektion vor:
1. **Blutung stoppen** mit Druck.
2. **Hände waschen** oder Handschuhe tragen.
3. **Wunde ausspülen** mit reichlich sauberem Trinkwasser oder abgekochtem, abgekühltem Wasser. Schmutz vorsichtig herausspülen.
4. Die Haut um die Wunde **desinfizieren**, wenn möglich.
5. **Steril oder so sauber wie möglich abdecken** und den Verband täglich wechseln.
6. **Infektionszeichen beobachten:** Rötung, die sich ausbreitet, Schwellung, Wärme, Eiter, pochender Schmerz, Fieber oder rote Streifen. Dann so schnell wie möglich ärztliche Hilfe suchen.
7. **Tetanusschutz:** Die Impfung sollte nicht länger als 10 Jahre zurückliegen.
Tiefe, klaffende oder stark verschmutzte Wunden und Bisse gehören zum Arzt.`);

  E('hilfe-09', 'erstehilfe', 'Wie erkenne ich Dehydrierung und was hilft dagegen?',
    ['Anzeichen für Austrocknung', 'Symptome von zu wenig trinken', 'Dehydration behandeln', 'Trinklösung selber machen'],
    `
Anzeichen von Wassermangel:
- Durst, trockener Mund, **dunkler Urin** und seltenes Wasserlassen.
- Kopfschmerzen, Schwindel, Müdigkeit, Konzentrationsprobleme.
- Bei starkem Mangel Verwirrtheit, schneller Puls und Bewusstseinsstörungen. Das ist ein Notfall!
**Was hilft:**
- **Schluckweise trinken**, nicht alles auf einmal.
- Bei Durchfall, Erbrechen oder starkem Schwitzen **Elektrolyte** ersetzen. Notfallrezept der WHO: **1 Liter sauberes Wasser, 6 gestrichene Teelöffel Zucker und ½ gestrichener Teelöffel Salz**.
- Schatten suchen und Anstrengung vermeiden.
- Kinder, ältere Menschen und Kranke trocknen schneller aus.
Bei Verwirrtheit oder Bewusstlosigkeit: 112.`);

  E('hilfe-10', 'erstehilfe', 'Was tue ich bei einem Zeckenbiss oder Insektenstich?',
    ['Zecke entfernen', 'Wespenstich und Allergie', 'Insektenstich schwillt an'],
    `
**Zecke:**
1. Möglichst schnell mit Zeckenzange, Zeckenkarte oder feiner Pinzette **direkt an der Haut** greifen und langsam gerade herausziehen.
2. Nicht quetschen, kein Öl oder Kleber.
3. Stelle desinfizieren und einige Wochen beobachten. Bildet sich ein **wachsender roter Ring** oder kommen Fieber und Gliederschmerzen dazu, zum Arzt (Borreliose).
**Insektenstich:**
- Stachel vorsichtig wegschaben und die Stelle kühlen.
- **Notfall bei Allergie:** Atemnot, Schwellungen im Gesicht oder Hals, Kreislaufprobleme oder Ausschlag am ganzen Körper: sofort **112**. Wer ein Notfallset mit Adrenalin-Pen hat, benutzt es sofort.
- Stich im Mund oder Rachen: Eis lutschen, den Hals außen kühlen und 112 rufen.`);

  E('hilfe-11', 'erstehilfe', 'Was mache ich bei einem Schlangenbiss?',
    ['Kreuzotter-Biss', 'Schlangenbiss Erste Hilfe', 'Ich wurde von einer Schlange gebissen'],
    `
In Deutschland sind Bisse von Kreuzotter oder Aspisviper selten und für gesunde Erwachsene meist nicht lebensgefährlich. Trotzdem ernst nehmen:
1. **Ruhe bewahren** und die Person beruhigen. Wenig bewegen.
2. Die gebissene Stelle **ruhig stellen**.
3. **Ringe, Uhren und enge Kleidung** entfernen, weil es anschwellen kann.
4. **112 anrufen** oder zügig ins Krankenhaus.
5. **Nicht** aussaugen, ausschneiden, abbinden oder ausbrennen.
6. Die Schlange nicht fangen. Höchstens aus sicherer Entfernung fotografieren.
Besonders gefährdet sind Kinder, ältere Menschen und Allergiker.`);

  /* ---------------- Feuer ---------------- */
  E('feuer-01', 'feuer', 'Wie mache ich ein Feuer in der Natur?',
    ['Lagerfeuer machen', 'Feuer anzünden beim Survival', 'Wie baut man ein Feuer?'],
    `
Ein Feuer braucht drei Stufen Brennmaterial:
1. **Zunder:** sehr feines, trockenes Material, das sofort brennt, zum Beispiel trockenes Gras, Birkenrinde, Distelwolle, Baumharz oder Watte mit Vaseline.
2. **Anzündholz:** dünne Zweige, so dick wie ein Streichholz bis ein Bleistift. Tote Zweige an Bäumen sind trockener als die am Boden. Sie müssen beim Brechen knacken.
3. **Brennholz:** daumen- bis armdick. Erst dazugeben, wenn das Feuer kräftig brennt.
So geht es:
- Einen windgeschützten Platz wählen, den Boden freiräumen und mit Steinen eingrenzen.
- Zunder in die Mitte, Anzündholz als **Tipi** darüber, eine Lücke auf der Windseite lassen.
- Zunder anzünden, vorsichtig pusten und nach und nach dickeres Holz nachlegen.
Erst alles sammeln, dann anzünden, und zwar mindestens doppelt so viel, wie du denkst. Achte auf Waldbrandgefahr und örtliche Verbote.`);

  E('feuer-02', 'feuer', 'Wie mache ich Feuer ohne Feuerzeug?',
    ['Feuer ohne Streichhölzer', 'Feuerstahl benutzen', 'Feuer mit einer Batterie machen'],
    `
Die zuverlässigsten Methoden:
- **Feuerstahl (Ferrocerium-Stab):** Mit dem Schaber oder Messerrücken kräftig am Stab entlangziehen und die heißen Funken direkt in den Zunder lenken. Funktioniert auch nass.
- **9-Volt-Batterie und Stahlwolle:** Die Batteriepole an feine Stahlwolle halten, sie glüht sofort. Zunder bereithalten.
- **Brennglas:** Lupe, Brillenglas oder eine klare Flasche mit Wasser bündelt Sonnenlicht auf dunklen Zunder.
- **Reibungsfeuer (Bogenbohrer):** Funktioniert, braucht aber viel Übung, trockenes Holz und Kraft.
Immer mehrere Zündquellen dabeihaben: Feuerzeug, Sturmstreichhölzer im wasserdichten Behälter und einen Feuerstahl. Üben, bevor du es brauchst!`);

  E('feuer-03', 'feuer', 'Wie zünde ich ein Feuer bei Regen und mit nassem Holz an?',
    ['Feuer machen bei Regen', 'Nasses Holz anzünden', 'Feuer bei Nässe'],
    `
Auch bei Regen gibt es trockenes Material, wenn du weißt, wo:
- **Totes Holz an stehenden Bäumen** und Holz unter dichten Nadelbäumen ist trockener als Holz am Boden.
- **Holz spalten:** Innen ist auch nasses Holz oft trocken. Mit dem Messer feine Späne schnitzen (Feather Sticks).
- **Birkenrinde und Harz** brennen wegen ihrer Öle auch feucht.
- **Zunder am Körper** trocken halten, zum Beispiel in der Jackentasche.
- **Unterlage bauen:** Eine Lage Stöcke oder Rinde unter das Feuer, damit es nicht vom nassen Boden ausgeht.
- **Dach:** Eine Plane schräg und hoch genug über das Feuer spannen, damit sie nicht schmilzt.
- Klein starten, viel Anzündholz nachlegen und nasses Holz zum Trocknen neben das Feuer legen.
Grillanzünder oder Vaseline-Watte machen es viel leichter.`);

  E('feuer-04', 'feuer', 'Wie lösche ich ein Lagerfeuer richtig?',
    ['Feuer löschen', 'Lagerfeuer ausmachen', 'Glut sicher löschen'],
    `
Ein Feuer ist erst aus, wenn du die Asche mit der Hand berühren kannst:
1. Kein neues Holz mehr nachlegen und rechtzeitig herunterbrennen lassen.
2. **Viel Wasser** über die Glut gießen, nicht nur sprenkeln.
3. **Umrühren** mit einem Stock, damit das Wasser alle Glutnester erreicht.
4. Noch einmal Wasser darüber. Ohne Wasser mit Erde oder Sand bedecken und gründlich vermischen, das ist aber weniger sicher.
5. **Prüfen:** Die Hand über die Asche halten. Spürst du keine Wärme mehr, vorsichtig hineinfassen.
Nie ein Feuer unbeaufsichtigt lassen. Glut kann sich unter der Erde weiterfressen und Stunden später einen Waldbrand auslösen.`);

  E('feuer-05', 'feuer', 'Welche Feuerarten gibt es und wofür nimmt man sie?',
    ['Feuertypen beim Survival', 'Pyramidenfeuer und Sternfeuer', 'Welches Feuer zum Kochen?'],
    `
Je nach Zweck eignen sich unterschiedliche Feuer:
- **Tipi-Feuer:** Stöcke kegelförmig aufgestellt. Zündet schnell und gibt viel Hitze und Licht, gut zum Anfangen.
- **Blockhaus- oder Pyramidenfeuer:** Holz kreuzweise geschichtet. Brennt gleichmäßig lange und gibt gute Glut zum Kochen.
- **Sternfeuer:** Dicke Äste sternförmig zur Mitte, nach und nach nachschieben. Spart Holz und brennt die ganze Nacht.
- **Dakota-Feuerloch:** Feuer in einem Erdloch mit Luftkanal. Windgeschützt, rauchärmer und sehr effizient zum Kochen.
- **Schwedenfeuer:** Ein eingeschnittener Baumstamm, der von innen brennt und eine stabile Kochfläche bietet.
- **Reflektorfeuer:** Feuer vor einer Wand aus Steinen oder Holz, die die Wärme zum Unterschlupf zurückwirft.`);

  /* ---------------- Unterschlupf ---------------- */
  E('schutz-01', 'unterschlupf', 'Wie baue ich einen Unterschlupf in der Natur?',
    ['Shelter bauen', 'Notunterkunft im Wald', 'Survival-Unterschlupf bauen'],
    `
Ein einfacher und sehr wirksamer Notunterschlupf ist die **Laubhütte**:
1. **Ort wählen:** trocken und windgeschützt, nicht in einer Senke, nicht unter toten Ästen.
2. **Firststange:** einen langen, stabilen Ast (etwas länger als du) schräg an einen Baumstumpf oder in eine Astgabel lehnen.
3. **Rippen:** viele Äste schräg an beide Seiten lehnen, sodass ein schmales Zelt entsteht, gerade groß genug für dich.
4. **Isolieren:** mit Laub, Nadeln und Gras dick bedecken, **mindestens armlang**.
5. **Bodenisolierung:** eine dicke Schicht trockenes Laub oder Fichtenzweige als Matratze. Der Boden entzieht dir die meiste Wärme!
6. Den Eingang mit einem Laubhaufen verschließen.
Je kleiner der Innenraum, desto wärmer hält ihn deine Körperwärme.`);

  E('schutz-02', 'unterschlupf', 'Wie baue ich mit einer Plane einen Unterschlupf?',
    ['Tarp aufbauen', 'Unterschlupf aus einer Plane', 'Unterstand mit Tarp bauen'],
    `
Mit einer Plane (Tarp) und einer Schnur hast du in Minuten Schutz:
- **A-Form:** Eine Schnur zwischen zwei Bäumen spannen (etwa hüfthoch), die Plane darüberlegen und die Seiten schräg zum Boden abspannen. Schützt gut gegen Regen.
- **Pultdach:** Eine Seite hoch an der Schnur, die andere am Boden, mit dem Rücken zum Wind. Ideal mit einem Reflektorfeuer davor.
- **Ecken** mit Heringen, Steinen oder Stöcken befestigen.
- Die Plane **straff spannen**, damit Regen abläuft und sich kein Wasser sammelt.
- Einen Platz wählen, an dem Regenwasser abfließt.
- Unter dich immer eine **isolierende Schicht** legen.
Gute Knoten dafür sind der Palstek für feste Schlaufen und der Spannknoten zum Nachspannen.`);

  E('schutz-03', 'unterschlupf', 'Wo sollte ich in der Wildnis mein Lager aufschlagen?',
    ['Lagerplatz wählen', 'Wo zelten in der Wildnis?', 'Guten Biwakplatz finden'],
    `
Ein guter Lagerplatz erfüllt diese Punkte:
- **Wasser in der Nähe**, aber mit 50 bis 100 Metern Abstand zum Ufer, wegen Hochwasser, Kälte, Insekten und Tieren.
- **Brennholz und Baumaterial** in der Nähe.
- **Windschutz** durch Felsen, Bäume oder Gelände.
- **Nicht in Senken und trockenen Bachbetten:** Dort sammeln sich Kaltluft und bei Regen Wasser.
- **Nicht unter toten Bäumen oder Ästen** und bei Gewitter nicht unter einzeln stehenden hohen Bäumen.
- Leicht **erhöht und eben**, damit Regen abläuft.
- **Sichtbar für Retter**, wenn du gefunden werden willst.
In Deutschland ist Wildcampen vielerorts verboten. Im echten Notfall geht Sicherheit vor.`);

  E('schutz-04', 'unterschlupf', 'Wie schütze ich mich nachts im Freien vor Kälte?',
    ['Draußen schlafen bei Kälte', 'Eine Nacht im Freien überleben', 'Kaltes Biwak'],
    `
Die meiste Wärme verlierst du an den **Boden** und durch **Wind und Nässe**:
- **Von unten isolieren:** Isomatte, Rucksack oder eine dicke Schicht Laub, Fichtenzweige oder Rinde, mindestens 10 bis 20 cm.
- **Windschutz:** hinter Felsen, im Unterschlupf oder mit einer Plane als Wand.
- **Trocken bleiben:** Nasse Kleidung wechseln und vor dem Hinlegen nicht schwitzen.
- **Zwiebelprinzip**, Mütze auf, trockene Socken an.
- **Rettungsdecke** eng um dich wickeln, darüber Kleidung oder Laub.
- **Vor dem Schlafen essen** (Fett und Kohlenhydrate) und warm trinken.
- **Warme Steine:** am Feuer erhitzte Steine in Stoff gewickelt zu den Füßen legen. Keine Steine aus dem Bach, sie können beim Erhitzen platzen.
- Einen kleinen Raum wählen, den deine Körperwärme heizen kann.`);

  /* ---------------- Ausrüstung & Knoten ---------------- */
  E('ausr-01', 'ausruestung', 'Welche Ausrüstung brauche ich für eine Tour in der Wildnis?',
    ['Survival-Ausrüstung Liste', 'Notfallset für Outdoor', 'Was nehme ich mit in die Wildnis?'],
    `
Die **10 Grundlagen** für jede Tour in der Natur:
1. **Navigation:** Karte, Kompass, geladenes Handy mit Offline-Karte.
2. **Licht:** Stirnlampe mit Ersatzbatterien.
3. **Sonnenschutz:** Brille, Sonnencreme, Kopfbedeckung.
4. **Erste Hilfe:** kleines Set mit Rettungsdecke und Pfeife.
5. **Messer** oder Multitool.
6. **Feuer:** Feuerzeug, Sturmstreichhölzer, Feuerstahl, Zunder.
7. **Unterschlupf:** leichte Plane oder Biwaksack.
8. **Extra-Essen:** mehr als geplant.
9. **Extra-Wasser** und eine Möglichkeit zur Aufbereitung.
10. **Extra-Kleidung:** Wärme- und Regenschicht.
Dazu Schnur, Klebeband und eine Powerbank. Und das Wichtigste: Vorher jemandem sagen, **wohin du gehst und wann du zurück bist**.`);

  E('ausr-02', 'ausruestung', 'Welche Knoten sollte man für Survival kennen?',
    ['Knoten fürs Survival', 'Palstek binden', 'Die wichtigsten Knoten'],
    `
Mit wenigen Knoten kommst du sehr weit:
- **Palstek:** eine feste Schlaufe, die sich nicht zuzieht und leicht wieder lösen lässt.
- **Mastwurf:** eine Leine schnell an einem Pfahl oder Ast befestigen.
- **Spannknoten:** zum straffen Abspannen von Planen und Leinen.
- **Kreuzknoten:** zwei gleich dicke Seile verbinden, zum Beispiel bei Verbänden.
- **Schotstek:** zwei unterschiedlich dicke Seile verbinden.
- **Achterknoten:** als Stopper am Seilende.
- **Prusikknoten:** rutscht unter Last nicht, gut zum Abspannen.
Übe jeden Knoten so oft, bis du ihn im Dunkeln und mit kalten Händen binden kannst.`);

  E('ausr-03', 'ausruestung', 'Wie benutze ich ein Messer sicher in der Natur?',
    ['Messer beim Survival', 'Sicher schnitzen', 'Welches Messer für draußen?'],
    `
Ein Messer ist eines der wichtigsten Werkzeuge und eine häufige Ursache für Verletzungen:
- **Immer vom Körper weg schneiden.** Beine, Hände und andere Menschen gehören nicht in die Schnittlinie.
- **Sicherheitskreis:** Vor dem Schneiden mit ausgestrecktem Arm prüfen, dass niemand in Reichweite ist.
- **Scharf halten:** Ein stumpfes Messer rutscht eher ab.
- **Geschlossen oder in der Scheide** tragen und mit dem Griff voran weitergeben.
- **Sitzend arbeiten** und ruhige, kontrollierte Bewegungen machen.
- Für den Einstieg reicht ein feststehendes Messer mit 8 bis 10 cm Klinge oder ein gutes Taschenmesser.
Beachte das Waffengesetz: In Deutschland gelten Regeln für das Tragen von Messern in der Öffentlichkeit.`);

  E('ausr-04', 'ausruestung', 'Wie benutze ich eine Rettungsdecke richtig?',
    ['Rettungsdecke silber oder gold nach außen', 'Welche Seite der Rettungsdecke?', 'Wofür ist die Rettungsdecke gut?'],
    `
Eine Rettungsdecke wiegt fast nichts und kann Leben retten:
- Sie **hält die Körperwärme** zurück und schützt vor Wind und Nässe.
- **Welche Seite?** Entscheidend ist, dass sie **eng anliegt und gut eingewickelt** ist. Die Farbe nach außen macht nur einen kleinen Unterschied. Üblich ist Silber nach innen zum Wärmen.
- **Den Kopf** mit einpacken, das Gesicht frei lassen.
- **Von unten isolieren:** Die Rettungsdecke allein hält keine Bodenkälte ab. Rucksack, Jacke oder Laub darunterlegen.
- Unter einer Jacke getragen hält sie besser und reißt weniger.
- Sie dient auch als **Signal** (glänzt in der Sonne), als **Regenschutz** und zum **Wassersammeln**.`);

  /* ---------------- Orientierung & Rettung ---------------- */
  E('orient-01', 'orientierung', 'Was mache ich, wenn ich mich im Wald verlaufen habe?',
    ['Im Wald verlaufen', 'Verirrt, was tun?', 'Ich weiß nicht, wo ich im Wald bin'],
    `
Merke dir die **STOP-Regel**:
- **S, Stehen bleiben:** Nicht planlos weiterlaufen. Hinsetzen, trinken, durchatmen.
- **T, Denken:** Wo war ich zuletzt sicher? Welche Wege, Flüsse und Straßen habe ich gesehen?
- **O, Beobachten:** Gelände, Sonnenstand, Geräusche (Straßen, Bahn, Kirchenglocken), Akku, Wasser, Wetter und Tageslicht.
- **P, Planen:** Entscheiden, ob du auf bekanntem Weg zurückgehst, einen Notruf absetzt oder bleibst und auf Hilfe wartest.
Weitere Tipps:
- Mit dem Handy die **112** anrufen und den Standort aus der Karten-App durchgeben. Akku sparen.
- Wenn jemand weiß, wo du bist: **Bleib an einem Ort.** Suchende finden dich so leichter.
- Bei Dunkelheit nicht weitergehen. Unterschlupf und Wärme gehen vor.`);

  E('orient-02', 'orientierung', 'Wie finde ich ohne Kompass die Himmelsrichtung?',
    ['Norden finden ohne Kompass', 'Himmelsrichtung mit der Sonne bestimmen', 'Orientierung ohne Handy'],
    `
Mehrere Methoden auf der Nordhalbkugel:
- **Sonne:** Sie geht ungefähr im **Osten** auf, steht mittags im **Süden** (bei Sommerzeit etwa gegen 13:30 Uhr) und geht im **Westen** unter.
- **Uhr-Methode:** Eine analoge Uhr waagerecht halten und den **Stundenzeiger auf die Sonne** richten. Die Mitte zwischen Stundenzeiger und der 12 (bei Sommerzeit der 1) zeigt nach **Süden**.
- **Schattenstab:** Einen Stab senkrecht in den Boden stecken, die Schattenspitze markieren, 15 bis 20 Minuten warten und wieder markieren. Die Linie vom ersten zum zweiten Punkt zeigt ungefähr von **Westen nach Osten**.
- **Polarstern** in der Nacht.
- Moos an Bäumen ist **unzuverlässig**. Es wächst dort, wo es feucht ist, nicht unbedingt im Norden.`);

  E('orient-03', 'orientierung', 'Wie finde ich den Polarstern?',
    ['Polarstern finden', 'Norden in der Nacht finden', 'Mit dem Großen Wagen Norden finden'],
    `
Der Polarstern zeigt nachts fast genau nach **Norden**:
1. Suche den **Großen Wagen**: sieben helle Sterne in Form eines Wagens mit Deichsel.
2. Nimm die **zwei hinteren Sterne des Wagenkastens**, also die der Deichsel gegenüber.
3. Verlängere ihre Verbindungslinie **etwa fünfmal** nach oben.
4. Dort findest du einen einzelnen, mittelhellen Stern: den **Polarstern**. Er ist das Ende der Deichsel des Kleinen Wagens.
Unter dem Polarstern liegt am Horizont **Norden**. Er ist nicht der hellste Stern, bleibt aber fast an derselben Stelle, während sich die anderen Sterne um ihn drehen.`);

  E('orient-04', 'orientierung', 'Wie mache ich auf mich aufmerksam, wenn ich gerettet werden will?',
    ['Notsignal geben', 'SOS-Signal senden', 'Wie sehen mich Retter?', 'Signal für einen Hubschrauber'],
    `
Signale funktionieren am besten in **Dreiergruppen**, das bedeutet international Notfall:
- **Pfeife:** 3 kurze Pfiffe, Pause, wiederholen. Trägt viel weiter als die Stimme und spart Kraft.
- **Alpines Notsignal:** 6-mal pro Minute ein Zeichen (Pfiff, Licht, Winken), dann 1 Minute Pause, wiederholen. Die Antwort ist 3-mal pro Minute.
- **Feuer:** drei Feuer im Dreieck. Tagsüber grüne Zweige auflegen, das gibt hellen Rauch.
- **Signalspiegel** oder Handydisplay: Sonnenlicht gezielt zu Flugzeugen oder Hubschraubern lenken. Das ist kilometerweit sichtbar.
- **Am Boden:** ein großes **SOS** oder **X** aus Steinen, Ästen oder Kleidung auf freier Fläche, mindestens 3 Meter groß.
- **Helle Kleidung** oder eine Rettungsdecke ausbreiten.
- Bei Hubschraubern: **Beide Arme hoch (Y-Form)** heißt: Ja, wir brauchen Hilfe.`);

  E('orient-05', 'orientierung', 'Wie benutze ich Karte und Kompass?',
    ['Kompass benutzen', 'Karte einnorden', 'Marschrichtung bestimmen'],
    `
Die Grundlagen in vier Schritten:
1. **Karte einnorden:** Kompass auf die Karte legen und beides drehen, bis die Nordlinien der Karte mit der Kompassnadel übereinstimmen. Jetzt entspricht die Karte dem Gelände.
2. **Standort bestimmen:** Markante Punkte wie Berg, Kirche, Kreuzung oder Fluss in der Umgebung auf der Karte suchen.
3. **Marschrichtung festlegen:** Die Anlegekante des Kompasses von deinem Standort zum Ziel legen und die Kompassdose drehen, bis ihre Nordlinien parallel zu denen der Karte sind.
4. **Laufen:** Kompass waagerecht halten und dich drehen, bis die Nadel im Pfeil der Dose liegt. Peile einen markanten Punkt in Marschrichtung an, geh hin, dann zum nächsten.
Halte Abstand zu Metall und Elektronik, sie lenken die Nadel ab.`);

  E('orient-06', 'orientierung', 'Wie verhalte ich mich, wenn ich auf Rettung warte?',
    ['Auf Rettung warten', 'Warten auf die Bergrettung', 'Wie lange auf Hilfe warten?'],
    `
Warten ist oft die beste Strategie, wenn jemand weiß, wo du bist:
- **Am Ort bleiben**, besonders wenn du verletzt bist oder es dunkel wird. Bewegte Ziele sind schwerer zu finden.
- **Sichtbar werden:** offene Fläche in der Nähe, helle Kleidung, Rettungsdecke, Zeichen am Boden.
- **Akku sparen:** Handy in den Flugmodus und zu festen Zeiten kurz einschalten, um Anrufe oder SMS zu empfangen.
- **Wärme und Schutz:** Unterschlupf, Isolierung vom Boden, trocken bleiben.
- **Regelmäßig trinken** in kleinen Mengen.
- **Kraft sparen** und den Kopf beschäftigen.
- **Hörbar bleiben:** Bei Geräuschen von Suchtrupps in Dreiergruppen pfeifen oder rufen.
Vor jeder Tour gilt: jemandem Route und Rückkehrzeit sagen.`);

  /* ---------------- Nahrung aus der Natur ---------------- */
  E('nahr-01', 'nahrung', 'Welche Pflanzen kann man in Deutschland in der Natur essen?',
    ['Essbare Wildpflanzen', 'Wildkräuter beim Survival essen', 'Was kann man im Wald essen?'],
    `
Einige häufige Wildpflanzen sind gut zu erkennen und essbar:
- **Brennnessel:** junge Blätter gekocht wie Spinat, sehr nährstoffreich.
- **Löwenzahn:** Blätter, Blüten und Wurzeln.
- **Giersch:** junge Blätter wie Petersilie.
- **Spitzwegerich:** junge Blätter, hilft auch gegen Juckreiz bei Insektenstichen.
- **Brombeeren, Himbeeren, Walderdbeeren, Heidelbeeren.**
- **Haselnüsse, Walnüsse, Esskastanien** und **Bucheckern** (roh nur wenige, besser geröstet).
**Ganz wichtig:** Iss nur, was du **zu 100 % sicher** erkennst. Viele giftige Pflanzen sehen essbaren sehr ähnlich, etwa **Bärlauch** und die giftigen **Maiglöckchen** oder **Herbstzeitlosen**, oder der tödliche **Gefleckte Schierling**. Ein Bestimmungsbuch und ein Kurs mit Fachleuten sind Pflicht.`);

  E('nahr-02', 'nahrung', 'Darf ich im Notfall Pilze aus dem Wald essen?',
    ['Pilze sammeln beim Survival', 'Welche Pilze sind essbar?', 'Giftige Pilze erkennen'],
    `
Davon ist dringend abzuraten, wenn du kein ausgebildeter Pilzkenner bist.
- Einige der giftigsten Pilze, zum Beispiel der **Grüne Knollenblätterpilz**, sehen essbaren Arten ähnlich und sind schon in kleinen Mengen **tödlich**. Die Vergiftung zeigt sich oft erst nach vielen Stunden, wenn die Leber schon geschädigt ist.
- **Es gibt keinen einfachen Test**, der giftige Pilze erkennt. Silberlöffel-, Schnecken- oder Geschmackstests sind Mythen.
- Pilze haben **wenig Kalorien**. Das Risiko lohnt sich zum Überleben nicht.
Bei Verdacht auf eine Pilzvergiftung sofort **112** oder den **Giftnotruf** anrufen und Pilzreste aufbewahren.`);

  E('nahr-03', 'nahrung', 'Was ist der universelle Essbarkeitstest und ist er sicher?',
    ['Essbarkeitstest für Pflanzen', 'Testen, ob eine Pflanze giftig ist', 'Universal Edibility Test'],
    `
Der universelle Essbarkeitstest stammt aus alten Militärhandbüchern: Man testet eine Pflanze schrittweise über viele Stunden auf Haut, Lippen und Zunge und isst dann winzige Mengen.
**Er ist keine sichere Methode:**
- Manche Giftstoffe wirken erst nach vielen Stunden oder Tagen.
- Bei hochgiftigen Pflanzen kann schon eine kleine Menge gefährlich sein.
- **Für Pilze gilt er überhaupt nicht.**
- Er kostet viel Zeit und Energie.
Besser:
- Lerne vorher **wenige, eindeutig erkennbare Pflanzen** sicher kennen.
- Ein gesunder Mensch kommt **mehrere Wochen ohne Nahrung** aus. Wasser, Wärme und Rettung sind meist wichtiger.`);

  E('nahr-04', 'nahrung', 'Wie lange überlebt man ohne Essen und Wasser?',
    ['Die Regel der Drei', 'Ohne Wasser überleben, wie lange?', 'Wie lange ohne Essen überleben?'],
    `
Die **Dreier-Regel** zeigt, was zuerst wichtig ist (grobe Richtwerte):
- **3 Minuten ohne Luft**
- **3 Stunden ohne Schutz** vor extremer Kälte, Nässe oder Hitze
- **3 Tage ohne Wasser**
- **3 Wochen ohne Nahrung**
Die genauen Zeiten hängen von Temperatur, Anstrengung, Gesundheit und Alter ab. Bei Hitze kann Wassermangel schon nach einem Tag gefährlich werden.
Daraus folgt die Reihenfolge im Notfall:
1. Akute Gefahr abwenden und Erste Hilfe leisten.
2. **Schutz:** Unterschlupf, Wärme, trockene Kleidung.
3. **Wasser** finden und aufbereiten.
4. **Signale** für die Rettung.
5. Erst dann **Nahrung**.`);

  E('nahr-05', 'nahrung', 'Wie angle ich im Notfall ohne Angelausrüstung?',
    ['Fische fangen beim Survival', 'Angeln ohne Angel', 'Notangel bauen'],
    `
Im echten Notfall gibt es einfache Methoden:
- **Notangel:** Haken aus einer Sicherheitsnadel, Draht oder einem Dorn, Schnur aus Zahnseide, Nähgarn oder den Innenfäden einer Paracord-Schnur. Köder sind Würmer, Insekten oder Beeren.
- **Reuse:** aus Zweigen oder einer abgeschnittenen Plastikflasche mit nach innen gestecktem Hals und Köder. Sie fängt, während du anderes erledigst.
- **Fangplatz:** ruhige, tiefere Stellen, unter überhängenden Ufern, am Rand von Strömungen, morgens und abends.
**Wichtig:** In Deutschland brauchst du zum Angeln einen **Fischereischein und eine Erlaubnis**, Reusen sind meist verboten. Das gilt nur für den echten Notfall, wenn es ums Überleben geht.
Fisch immer gut durchgaren.`);

  E('nahr-06', 'nahrung', 'Kann man Insekten essen?',
    ['Insekten essen beim Survival', 'Würmer essen', 'Eiweiß aus der Natur'],
    `
Ja, viele Insekten sind eine gute Eiweiß- und Fettquelle:
- **Gut geeignet:** Heuschrecken, Grillen, Mehlwürmer, Käferlarven, Ameisen und Regenwürmer.
- **Immer durchgaren** (rösten oder kochen), das tötet Parasiten und Keime.
- Bei Heuschrecken Beine und Flügel entfernen.
- **Meiden:** bunte, behaarte oder stark riechende Insekten, Raupen, stechende Insekten sowie Fliegen und Zecken.
- Regenwürmer vorher in sauberem Wasser ausspülen lassen.
- Wer gegen Krebstiere allergisch ist, kann auch auf Insekten reagieren.`);

  /* ---------------- Kälte, Hitze & Wetter ---------------- */
  E('wetter-01', 'wetter', 'Wie erkenne und behandle ich eine Unterkühlung?',
    ['Unterkühlung Erste Hilfe', 'Hypothermie', 'Jemand ist völlig ausgekühlt'],
    `
**Anzeichen:**
- Leichte Unterkühlung: starkes **Zittern**, kalte blasse Haut, Ungeschicklichkeit.
- Schwere Unterkühlung: **Das Zittern hört auf**, Verwirrtheit, Müdigkeit, lallende Sprache, Bewusstseinsstörungen. Das ist ein Notfall.
**Was tun:**
1. **112 anrufen.**
2. Vor weiterer Kälte schützen: windgeschützter Ort, **von unten isolieren**.
3. **Nasse Kleidung vorsichtig entfernen** und gegen trockene tauschen oder in Decken, Schlafsack und Rettungsdecke einpacken, auch den Kopf.
4. Die Person **möglichst wenig bewegen** und schonend behandeln.
5. Wache Personen bekommen **warme, süße Getränke**. **Kein Alkohol.**
6. Wärmflaschen an Brust und Rumpf legen, **nicht an Armen und Beinen** und nicht direkt auf die Haut.
7. **Arme und Beine nicht reiben oder massieren.**
Bei Bewusstlosigkeit Atmung prüfen und wenn nötig wiederbeleben.`);

  E('wetter-02', 'wetter', 'Was mache ich bei Erfrierungen?',
    ['Erfrorene Finger', 'Erfrorene Zehen behandeln', 'Erfrierung Erste Hilfe'],
    `
Erfrierungen betreffen meist Finger, Zehen, Ohren, Nase und Wangen.
**Anzeichen:** Die Haut wird weiß-grau oder wachsartig, gefühllos und hart. Später können Blasen entstehen.
**Was tun:**
1. In einen warmen Raum oder geschützten Ort gehen.
2. **Körperwärme nutzen:** betroffene Finger in die Achselhöhle legen.
3. Ist sicher, dass es **nicht wieder gefriert**, langsam in **körperwarmem Wasser** (etwa 37 bis 39 °C) erwärmen.
4. **Nicht reiben**, nicht mit Schnee einreiben und nicht über Feuer oder Heizung aufwärmen. Die gefühllose Haut verbrennt leicht.
5. Blasen nicht öffnen und locker und keimfrei abdecken.
6. Ärztliche Hilfe suchen.`);

  E('wetter-03', 'wetter', 'Wie schütze ich mich bei großer Hitze?',
    ['Hitzschlag vorbeugen', 'Tipps bei einer Hitzewelle', 'Sonnenstich erkennen'],
    `
Bei Hitze ist **Wasser** das Wichtigste:
- **Regelmäßig trinken**, auch ohne Durst. Bei starkem Schwitzen zusätzlich Salz und Elektrolyte.
- **Schatten** suchen und die heiße Mittagszeit von 11 bis 17 Uhr meiden.
- **Helle, lockere Kleidung** und eine Kopfbedeckung tragen.
- Den Körper mit **feuchten Tüchern** kühlen.
- In der Wohnung tagsüber Fenster und Rollläden schließen und nachts lüften.
**Hitzschlag ist ein Notfall:** hohe Körpertemperatur, heiße Haut, Verwirrtheit, Kopfschmerzen oder Erbrechen. Dann **112**, sofort in den Schatten, Kleidung lockern und mit feuchten Tüchern kühlen.
**Sonnenstich:** roter, heißer Kopf, Kopf- und Nackenschmerzen, Übelkeit. Dann Schatten, Kopf leicht erhöht lagern und kühlen.`);

  E('wetter-04', 'wetter', 'Was mache ich bei einem Gewitter im Freien?',
    ['Gewitter draußen', 'Blitzschlag vermeiden', 'Gewitter in den Bergen'],
    `
Bei Gewitter gilt die **30/30-Regel**: Liegen zwischen Blitz und Donner weniger als 30 Sekunden, sofort Schutz suchen. Erst 30 Minuten nach dem letzten Donner wieder hinaus.
- **Bester Schutz:** ein Gebäude oder ein Auto mit geschlossener Metallkarosserie.
- **Meiden:** Gipfel, Grate, freie Flächen, einzeln stehende Bäume, Masten, Zäune und Wasser.
- **Im Wald** Abstand zu den höchsten Bäumen halten. Ein dichter Bestand gleich hoher Bäume ist besser als der Waldrand.
- **Kein Schutz in der Nähe:** In eine Mulde gehen und mit **geschlossenen Füßen in die Hocke**, Kopf einziehen, Arme um die Knie. Nicht hinlegen.
- In der Gruppe mehrere Meter Abstand halten.
- Wanderstöcke und andere Metallteile weglegen.`);

  E('wetter-05', 'wetter', 'Wie ziehe ich mich richtig gegen Kälte und Nässe an?',
    ['Das Zwiebelprinzip', 'Kleidung für Survival', 'Was ziehe ich bei Kälte draußen an?'],
    `
Das **Zwiebelprinzip** mit drei Schichten:
1. **Basisschicht** direkt auf der Haut: Sie transportiert Schweiß weg. Am besten **Merinowolle oder Kunstfaser**. **Keine Baumwolle**, sie saugt sich voll und kühlt dich aus.
2. **Wärmeschicht:** Fleece, Wollpullover oder eine Daunen- oder Kunstfaserjacke.
3. **Schutzschicht:** wind- und wasserdichte Jacke und Hose.
Weitere Tipps:
- **Mütze, Handschuhe und Schal** schützen Kopf, Hände und Hals, die schnell Wärme verlieren.
- **Trockene Ersatzsocken** wasserdicht verpacken.
- **Schwitzen vermeiden:** Beim Gehen Schichten ausziehen und in Pausen sofort wieder anziehen.
- Nasse Kleidung so schnell wie möglich wechseln.`);

  /* ---------------- Evakuierung & Notgepäck ---------------- */
  E('evak-01', 'evakuierung', 'Was gehört in einen Notfallrucksack?',
    ['Notgepäck Liste', 'Fluchtrucksack packen', 'Bug Out Bag', 'Rucksack für die Evakuierung'],
    `
Ein Notfallrucksack pro Person sollte griffbereit stehen, damit du in Minuten das Haus verlassen kannst:
- **Dokumentenmappe** (Kopien), Bargeld, Ersatzschlüssel.
- **Wasser** (mindestens 1 bis 2 Liter) und Wasserfilter oder Entkeimungstabletten.
- **Essen für 2 bis 3 Tage:** Energieriegel, Nüsse, Trockenobst.
- **Erste-Hilfe-Set** und persönliche Medikamente.
- **Kleidung:** wetterfeste Jacke, Wechselsachen, Mütze, feste Schuhe.
- **Rettungsdecke** und Schlafsack oder Decke.
- **Stirnlampe**, Batterieradio, Powerbank und Ladekabel.
- **Taschenmesser**, Feuerzeug, Klebeband, Schnur, Müllbeutel.
- **Hygiene:** Zahnbürste, Seife, Toilettenpapier, Hygieneartikel.
- **FFP2-Masken** und Arbeitshandschuhe.
- Eine **Liste mit wichtigen Telefonnummern** auf Papier.
- Für Kinder ein Kuscheltier oder Spiel.
Pack ihn so leicht, dass du ihn eine Stunde lang zu Fuß tragen kannst.`);

  E('evak-02', 'evakuierung', 'Welche Dokumente sollte ich im Notfall dabeihaben?',
    ['Dokumentenmappe für den Notfall', 'Wichtige Papiere bei einer Evakuierung', 'Welche Unterlagen mitnehmen?'],
    `
Die **Dokumentenmappe** solltest du im Notfall sofort greifen können, Originale wasserdicht verpackt und Kopien im Notfallrucksack:
- Personalausweis, Reisepass, Führerschein
- Geburts- und Heiratsurkunden
- Versicherungsunterlagen, Mietvertrag oder Grundbuchauszug
- Zeugnisse und Berufsnachweise
- Impfpass, Medikamentenplan, wichtige Arztbriefe, Allergiepass
- Bankdaten, Verträge, Testament und Vollmachten
- Fotos der Familie (helfen bei der Suche nach Vermissten)
- Liste mit Telefonnummern und Adressen
Tipp: Zusätzlich verschlüsselte digitale Kopien auf einem USB-Stick ablegen.`);

  E('evak-03', 'evakuierung', 'Wann sollte ich mein Zuhause verlassen und wann bleiben?',
    ['Evakuieren oder zu Hause bleiben?', 'Zu Hause bleiben in der Krise', 'Wann sollte ich fliehen?'],
    `
In den meisten Krisen ist **zu Hause bleiben** sicherer. Dort hast du Vorräte, Wärme und Schutz. Verlassen solltest du dein Zuhause, wenn:
- **die Behörden zur Evakuierung auffordern**. Dann sofort folgen.
- **direkte Gefahr** droht: Feuer, Hochwasser, Gasgeruch, Einsturzgefahr oder Gefahrstoffe in der Nähe.
- das Haus unbewohnbar ist, zum Beispiel ohne Wärme im Winter über Tage oder ohne Wasser.
- medizinische Hilfe nötig ist, die es zu Hause nicht gibt.
Wenn du gehst:
- Notfallrucksack und Dokumente mitnehmen, Haustiere nicht vergessen.
- Strom, Gas und Wasser abstellen, wenn die Behörden dazu auffordern.
- Nachbarn Bescheid geben und eine Nachricht hinterlassen, wohin du gehst.
- Die **empfohlenen Routen** nutzen.`);

  E('evak-04', 'evakuierung', 'Wie plane ich eine Evakuierung mit der Familie?',
    ['Fluchtplan für die Familie', 'Evakuierungsplan erstellen', 'Familie auf Evakuierung vorbereiten'],
    `
Ein Plan spart im Ernstfall wertvolle Minuten:
1. **Ziele festlegen:** ein Ort in der Nähe (Freunde) und einer weiter weg (Verwandte in einer anderen Region).
2. **Mehrere Routen** auf einer Papierkarte markieren, auch zu Fuß.
3. **Treffpunkte** für den Fall, dass ihr getrennt werdet.
4. **Aufgaben verteilen:** Wer nimmt was mit? Wer kümmert sich um Kinder, Ältere und Haustiere?
5. **Auto:** den Tank immer mindestens halb voll halten.
6. **Notfallrucksäcke** fertig gepackt, Dokumentenmappe griffbereit.
7. **Checkliste an der Haustür:** Herd aus, Fenster zu, Medikamente, Ladekabel, Haustier.
8. **Üben:** Einmal im Jahr einen Probealarm machen. Wie lange braucht ihr bis zur Abfahrt?`);

  E('evak-05', 'evakuierung', 'Wie verhalte ich mich in einer Notunterkunft?',
    ['Notunterkunft in der Turnhalle', 'Sammelunterkunft nach einer Evakuierung', 'Regeln im Notlager'],
    `
In einer Notunterkunft wie einer Turnhalle leben viele Menschen auf engem Raum:
- **Registrieren** lassen. So können Angehörige dich finden.
- Wenn möglich eigenen **Schlafsack, Isomatte, Medikamente, Ladekabel und Hygieneartikel** mitbringen.
- **Rücksicht nehmen:** Ruhezeiten einhalten, Platz teilen, Müll entsorgen.
- **Hygiene:** Hände waschen. Bei Krankheitszeichen das Personal informieren und Abstand halten.
- **Wertsachen** am Körper tragen.
- **Mithelfen:** Viele Aufgaben wie Essen ausgeben, Kinder betreuen oder Übersetzen brauchen Freiwillige. Das hilft auch gegen das Gefühl der Hilflosigkeit.
- **Kinder** im Blick behalten und einen Treffpunkt in der Unterkunft vereinbaren.`);

  /* ---------------- Strahlung, Chemie & Seuchen ---------------- */
  E('abc-01', 'abc', 'Was mache ich bei einem Atomunfall oder Strahlungsalarm?',
    ['Was tun bei einem Unfall im Atomkraftwerk?', 'Schutz vor radioaktiver Strahlung', 'Strahlenalarm'],
    `
Bei radioaktiver Gefahr gilt: **Rein. Tür zu. Radio an.**
1. **Sofort in ein Gebäude gehen**, am besten aus Stein oder Beton. Keller oder innen liegende Räume ohne Fenster sind am besten.
2. **Fenster und Türen schließen**, Lüftung und Klimaanlage ausschalten.
3. Wenn du draußen warst: **Oberbekleidung ausziehen**, in einer Plastiktüte vor die Tür legen, **duschen** und die Haare waschen.
4. **Radio, Warn-App oder Fernsehen** einschalten und den Anweisungen der Behörden folgen.
5. Nur Lebensmittel und Wasser aus geschlossenen Behältern oder aus dem Haus verwenden.
6. **Jodtabletten nur nach ausdrücklicher Aufforderung der Behörden** einnehmen, nicht vorsorglich!
7. Im Haus bleiben, bis Entwarnung kommt oder eine Evakuierung angeordnet wird.`);

  E('abc-02', 'abc', 'Wann soll ich Jodtabletten nehmen?',
    ['Jodtabletten beim Atomunfall', 'Kaliumiodid einnehmen', 'Hilft Jod gegen Strahlung?'],
    `
**Nur, wenn die Behörden ausdrücklich dazu auffordern.**
- Jodtabletten (Kaliumiodid) schützen **nur die Schilddrüse** vor radioaktivem Jod, nicht vor anderer Strahlung.
- Sie wirken nur zum richtigen Zeitpunkt, kurz vor oder beim Eintreffen der radioaktiven Wolke.
- In Deutschland wird die Einnahme für **Menschen unter 45 Jahren** sowie für Schwangere und Stillende empfohlen. Über 45 überwiegen die Risiken von Nebenwirkungen.
- **Nicht selbst** hochdosiertes Jod oder Jodsalz nehmen. Das hilft nicht und kann schaden.
- Bei Schilddrüsenerkrankungen vorher ärztlichen Rat einholen.
Im Ernstfall geben die Behörden Tabletten über vorbereitete Stellen aus.`);

  E('abc-03', 'abc', 'Wie schütze ich mich bei einem Chemieunfall?',
    ['Was tun bei einem Chemieunfall?', 'Warnung vor Giftgas', 'Gefahrstoffe in der Luft'],
    `
Bei einer Warnung vor gefährlichen Stoffen in der Luft:
1. **In ein Gebäude gehen** und dort bleiben. Draußen quer zur Windrichtung weggehen, nicht durch Rauch oder Nebelwolken.
2. **Fenster und Türen schließen**, Lüftungen und Klimaanlagen ausschalten.
3. In einen **innen liegenden Raum** gehen, möglichst in einem oberen Stockwerk. Viele Gase sind schwerer als Luft und sammeln sich im Keller.
4. Ritzen an Türen und Fenstern mit nassen Tüchern und Klebeband abdichten.
5. **Radio oder Warn-App** einschalten und den Anweisungen folgen.
6. Bei Augen- oder Hautkontakt mit viel Wasser spülen. Bei Atemnot oder Vergiftungszeichen: **112**.
Nicht neugierig zum Unfallort gehen.`);

  E('abc-04', 'abc', 'Wie bereite ich mich auf eine Pandemie vor?',
    ['Vorbereitung auf eine Pandemie', 'Schutz vor einer Seuche', 'Was tun bei einem Virusausbruch?'],
    `
Bei einer gefährlichen Infektionskrankheit helfen vor allem einfache Maßnahmen:
- **Hygiene:** Regelmäßig und gründlich **Hände waschen** (mindestens 20 Sekunden mit Seife), in die Armbeuge husten, das Gesicht nicht anfassen.
- **Masken:** Dicht sitzende **FFP2-Masken** schützen gut.
- **Abstand** zu Kranken und Menschenmengen halten.
- **Vorrat** für zwei Wochen, falls du in Quarantäne musst.
- **Medikamente** gegen Fieber und Erkältung sowie persönliche Medikamente bevorraten.
- **Impfungen** nach Empfehlung der Ständigen Impfkommission.
- **Kranke versorgen:** eigenes Zimmer, eigene Handtücher, Oberflächen reinigen, beim Pflegen Maske tragen.
- Nur **verlässlichen Quellen** vertrauen, zum Beispiel Gesundheitsamt und Robert Koch-Institut.
Bei schweren Symptomen wie Atemnot die Arztpraxis anrufen oder die **112**.`);

  E('abc-05', 'abc', 'Was mache ich bei einem atomaren Angriff?',
    ['Atombombe, was tun?', 'Nuklearangriff überleben', 'Schutz bei einem Atomkrieg'],
    `
Das ist extrem unwahrscheinlich, aber diese Regeln retten Leben:
1. **Beim Lichtblitz:** nicht hinsehen. Sofort **hinter Deckung oder flach auf den Boden**, Gesicht nach unten. Die Druckwelle kann Sekunden später kommen.
2. **So schnell wie möglich in ein festes Gebäude**, am besten in den Keller oder in die Mitte eines großen Gebäudes. Das schützt vor dem radioaktiven Niederschlag, der in den ersten Stunden am stärksten ist.
3. **Mindestens 24 Stunden drinnen bleiben**, wenn die Behörden nichts anderes sagen. Die Strahlung des Niederschlags nimmt in den ersten Tagen stark ab.
4. Wer draußen war: **Kleidung ausziehen und duschen**, Haare mit Shampoo ohne Spülung waschen.
5. **Radio** mit Batterie oder Kurbel einschalten und den Anweisungen folgen.
6. Wasser und Essen aus geschlossenen Behältern verwenden.
Merksatz: **Reingehen, drinbleiben, informiert bleiben.**`);

  E('abc-06', 'abc', 'Was ist ein Schutzraum und wo finde ich einen?',
    ['Bunker in Deutschland finden', 'Schutzraum im Krieg', 'Gibt es öffentliche Schutzräume?'],
    `
Öffentliche Schutzräume aus dem Kalten Krieg gibt es in Deutschland nur noch wenige, die meisten wurden seit 2007 aufgegeben. Bund und Länder arbeiten an neuen Konzepten, etwa an einer Übersicht über geeignete Gebäude wie Tiefgaragen, U-Bahnhöfe und Keller.
So schützt du dich trotzdem:
- Ein **Keller** oder ein **innen liegender Raum** mit dicken Wänden und wenigen Fenstern bietet guten Schutz.
- Je **mehr Masse** (Beton, Erde, Ziegel) zwischen dir und draußen, desto besser.
- In großen Gebäuden: die **Mitte** und die unteren Stockwerke.
- Vorher einen **Schutzplatz** im Haus festlegen und dort Wasser, Licht, Radio, Decken und Erste-Hilfe-Set lagern.
Aktuelle Informationen zu Schutzräumen gibt es beim BBK und bei deiner Gemeinde.`);

  /* ---------------- Naturkatastrophen ---------------- */
  E('kat-01', 'katastrophen', 'Was mache ich bei Hochwasser?',
    ['Was tun bei Hochwasser?', 'Verhalten bei einer Überschwemmung', 'Der Keller läuft voll'],
    `
Bei Hochwasser zählt Zeit:
- **Warnungen ernst nehmen** (Radio, NINA, Hochwasserportale) und Anweisungen folgen.
- **Wertsachen, Dokumente und Vorräte** in obere Stockwerke bringen.
- **Strom abschalten**, bevor Wasser in Keller oder Wohnung läuft. **Nie einen überfluteten Keller betreten**, es besteht Lebensgefahr durch Strom und Wasserdruck.
- **Heizöltanks sichern** und Chemikalien hochstellen.
- **Nicht durch fließendes Wasser gehen oder fahren:** Schon 15 cm schnell fließendes Wasser können dich umwerfen, etwa 30 cm ein Auto wegspülen.
- Bei Gefahr ins **obere Stockwerk** oder aufs Dach und von dort Hilfe signalisieren.
- Hochwasser ist **verschmutzt:** Kontakt vermeiden und danach gründlich waschen.
- Leitungswasser erst nach Freigabe trinken.`);

  E('kat-02', 'katastrophen', 'Wie verhalte ich mich bei einem schweren Sturm?',
    ['Was tun bei einem Orkan?', 'Verhalten bei einer Sturmwarnung', 'Unwetter zu Hause'],
    `
Bei einer Sturm- oder Orkanwarnung:
- **Drinnen bleiben** und Abstand zu Fenstern halten.
- **Draußen alles sichern** oder hereinholen: Gartenmöbel, Blumentöpfe, Mülltonnen, Trampoline.
- **Fenster, Türen und Rollläden schließen.**
- Das **Auto** nicht unter Bäumen parken und unnötige Fahrten vermeiden.
- **Nicht in den Wald gehen.** Auch Tage nach dem Sturm können Äste und Bäume umstürzen.
- **Geräte laden** und mit einem Stromausfall rechnen.
- Draußen Abstand zu Bäumen, Baugerüsten und Stromleitungen halten.
- **Heruntergefallene Stromleitungen** nie berühren, mindestens 20 Meter Abstand halten und 112 rufen.`);

  E('kat-03', 'katastrophen', 'Was tue ich bei einem Erdbeben?',
    ['Verhalten bei einem Erdbeben', 'Erdbeben, was tun drinnen?', 'Die Erde bebt'],
    `
Die wichtigste Regel heißt **Runter, Schützen, Festhalten**:
1. **Runter** auf Hände und Knie, damit dich das Beben nicht umwirft.
2. **Schützen:** Kopf und Nacken mit den Armen schützen und wenn möglich unter einen stabilen Tisch kriechen.
3. **Festhalten**, bis das Beben vorbei ist.
- **Nicht nach draußen rennen**, solange es bebt. Herabfallende Teile sind die größte Gefahr. Weg von Fenstern, Regalen und Lampen.
- **Draußen** Abstand zu Gebäuden, Bäumen und Leitungen halten.
- **Im Auto** anhalten, nicht unter Brücken, und im Auto bleiben.
**Danach** mit Nachbeben rechnen, bei Gasgeruch das Gas abstellen, Verletzte versorgen, beschädigte Gebäude verlassen und das Radio einschalten.`);

  E('kat-04', 'katastrophen', 'Was mache ich, wenn ein Waldbrand in der Nähe ist?',
    ['Flucht vor einem Waldbrand', 'Verhalten bei einem Waldbrand', 'Feuer im Wald, was tun?'],
    `
Ein Waldbrand kann sich sehr schnell ausbreiten:
- **Sofort 112** anrufen und den Ort möglichst genau angeben.
- **Anweisungen der Behörden folgen** und Evakuierungen sofort umsetzen. Nicht warten, bis du Flammen siehst.
- **Quer zur Windrichtung** oder gegen den Wind fliehen und **nie bergauf**. Feuer breitet sich bergauf besonders schnell aus.
- Ziel sind Straßen, Gewässer, Felder ohne Bewuchs oder bereits abgebrannte Flächen.
- **Rauch:** ein feuchtes Tuch vor Mund und Nase halten und tief am Boden bleiben.
- **Im Auto** Fenster und Lüftung schließen und das Licht einschalten.
- **Zu Hause** Fenster und Türen schließen und brennbares Material vom Haus wegräumen.`);

  E('kat-05', 'katastrophen', 'Was beachte ich, wenn ich nach einer Katastrophe in mein beschädigtes Haus zurückkehre?',
    ['Nach dem Hochwasser zurück ins Haus', 'Rückkehr in ein beschädigtes Haus', 'Aufräumen nach der Katastrophe'],
    `
Erst zurückgehen, wenn die Behörden es erlauben. Dann:
- **Von außen prüfen:** Risse, Absenkungen oder schiefe Wände. Bei Einsturzgefahr nicht betreten.
- **Gasgeruch?** Sofort raus, keine Schalter betätigen, kein Feuer, von draußen den Gasnotdienst oder **112** rufen.
- **Strom** erst von einer Elektrofachkraft prüfen lassen, wenn Wasser im Haus war.
- **Schutzkleidung:** feste Schuhe, Handschuhe und eine Maske gegen Schimmel und Staub.
- **Schäden fotografieren** für die Versicherung, bevor du aufräumst.
- **Lebensmittel**, die mit Hochwasser in Kontakt waren, wegwerfen.
- **Trinkwasser** erst nach Freigabe nutzen.
- Gut lüften und trocknen, um Schimmel zu vermeiden.`);

  /* ---------------- Krisenszenarien ---------------- */
  E('szen-01', 'szenarien', 'Was passiert bei einem EMP und wie schütze ich meine Elektronik?',
    ['Schutz vor einem EMP', 'Elektromagnetischer Puls', 'Faradayschen Käfig bauen'],
    `
Ein **EMP** (elektromagnetischer Puls) ist ein extrem starker, kurzer Energieimpuls, zum Beispiel durch eine Atomexplosion in großer Höhe. Ähnliche Effekte auf Stromnetze kann ein sehr starker **Sonnensturm** haben.
Mögliche Folgen sind ein großflächiger Stromausfall, beschädigte Transformatoren und ausgefallene Elektronik.
Schutz für wichtige Kleingeräte:
- **Faradayscher Käfig:** Geräte wie Radio, Funkgerät, Taschenlampe oder ein Ersatzhandy in einer **verschlossenen Metallbox** oder einem Metalleimer mit dichtem Deckel lagern. Innen mit Pappe oder Stoff vom Metall **isolieren**.
- Mehrere Lagen **Alufolie** um das Gerät, mit einer isolierenden Schicht dazwischen, wirken ähnlich.
- Ausgeschaltete Geräte, die nicht am Netz hängen, sind weniger gefährdet.
Ein EMP ist sehr unwahrscheinlich. Die Vorsorge ist dieselbe wie für einen langen Blackout: Wasser, Essen, Wärme, Licht und ein Radio.`);

  E('szen-02', 'szenarien', 'Was mache ich, wenn die Versorgung mit Lebensmitteln wochenlang zusammenbricht?',
    ['Die Versorgung bricht zusammen', 'Leere Supermärkte in einer langen Krise', 'Auf eine Hungersnot vorbereiten'],
    `
Bei einem langen Zusammenbruch der Versorgung kommt es auf Planung und Gemeinschaft an:
1. **Bestand erfassen:** Wie viel Wasser, Essen, Medikamente und Brennstoff habt ihr? Für wie viele Tage reicht es?
2. **Früh und gleichmäßig einteilen:** lieber jeden Tag etwas weniger als später gar nichts.
3. **Wasser zuerst sichern:** Regenwasser sammeln, Brunnen in der Nähe, Aufbereitung.
4. **Gemeinschaft nutzen:** Mit Nachbarn zusammenlegen. Gemeinsam kochen spart Brennstoff.
5. **Offizielle Hilfe:** Verteilstellen von Gemeinde, THW und Hilfsorganisationen nutzen. Der Staat hält Notreserven an Lebensmitteln.
6. **Selbst erzeugen:** Gemüse anbauen, Wildkräuter sicher sammeln, Lebensmittel haltbar machen.
7. **Gesund bleiben:** Hygiene und Wasserqualität sind jetzt besonders wichtig.
8. Ruhig bleiben und **zusammenhalten**. Plünderungen und Streit verschlimmern jede Lage.`);

  E('szen-03', 'szenarien', 'Wie bereite ich mich auf einen Krieg oder Verteidigungsfall vor?',
    ['Vorsorge für den Kriegsfall', 'Verteidigungsfall in Deutschland, was tun?', 'Auf einen Krieg vorbereiten'],
    `
Die Vorsorge für den Kriegsfall ähnelt der für andere große Krisen. Das BBK rät zu:
- **Vorrat** für mindestens 10 Tage: Wasser, Lebensmittel, Medikamente, Hygieneartikel.
- **Notfallrucksack und Dokumentenmappe** griffbereit.
- **Warnungen kennen:** Sirenensignale, Warn-Apps NINA und KATWARN, Cell Broadcast, Radio.
- **Schutzplatz** im Haus festlegen: Keller oder innen liegender Raum.
- **Kurbel- oder Batterieradio**, Licht und Powerbanks.
- **Erste-Hilfe-Kenntnisse** auffrischen.
- Ein **Familien-Notfallplan** mit Treffpunkten und Kontakten.
- **Bargeld** in kleinen Scheinen.
- Engagement bei **THW, DRK oder Feuerwehr**: Dort lernst du viel und hilfst anderen.
Im Ernstfall den Anweisungen der Behörden folgen und keine Gerüchte verbreiten.`);

  E('szen-04', 'szenarien', 'Was bedeutet ein Cyberangriff auf die Infrastruktur für mich?',
    ['Cyberangriff auf das Stromnetz', 'Hackerangriff in der Krise', 'Das Internet fällt aus'],
    `
Ein Cyberangriff kann Strom-, Wasser- oder Kommunikationsnetze, Banken oder Krankenhäuser lahmlegen. Für dich hat das ähnliche Folgen wie ein Blackout:
- **Bargeld** bereithalten, falls Kartenzahlung und Online-Banking ausfallen.
- **Wichtige Dokumente und Kontakte auf Papier.**
- **Vorrat** für 10 Tage, Radio und Licht.
- **Eigene Geräte schützen:** Updates installieren, starke Passwörter und Zwei-Faktor-Anmeldung nutzen, regelmäßig Sicherungskopien machen, auch offline.
- **Vorsicht vor Falschmeldungen:** In Krisen kursieren gefälschte Nachrichten und Betrugsmaschen. Nur offiziellen Quellen glauben.
- Keine Links in unerwarteten Nachrichten anklicken, besonders wenn sie Panik machen oder zur Eile drängen.`);

  /* ---------------- Sicherheit & Gemeinschaft ---------------- */
  E('sich-01', 'sicherheit', 'Wie schütze ich mein Zuhause in einer langen Krise vor Einbrechern?',
    ['Haus in der Krise sichern', 'Schutz vor Plünderern', 'Einbruchschutz beim Blackout'],
    `
In unsicheren Zeiten hilft vor allem, **kein attraktives Ziel** zu sein:
- **Türen und Fenster** geschlossen und verriegelt halten, auch tagsüber. Zusatzschlösser und Querriegel helfen.
- **Vorräte nicht zur Schau stellen** und nicht öffentlich darüber reden.
- **Unauffällig bleiben:** kein helles Licht, das nachts weit sichtbar ist, Fenster abdunkeln.
- **Nachbarschaft organisieren:** gemeinsam aufeinander achten und Absprachen treffen.
- **Bewegungsmelder-Lampen** mit Batterie oder Solar am Eingang.
- **Nicht den Helden spielen.** Dein Leben ist wichtiger als Besitz. Bei Gefahr zurückziehen, einschließen, Polizei (110) rufen oder Nachbarn alarmieren.
In echten Krisen ist **Zusammenhalt** viel wirksamer als Abschottung.`);

  E('sich-02', 'sicherheit', 'Wie gehe ich mit aggressiven Menschen in einer Krise um?',
    ['Deeskalation', 'Streit in der Krise vermeiden', 'Einen Konflikt im Notfall entschärfen'],
    `
In Stresssituationen eskalieren Konflikte schneller. **Deeskalation** schützt alle:
- **Ruhig bleiben:** langsam und leise sprechen, tief atmen.
- **Abstand halten**, mindestens zwei Armlängen, und dir einen Fluchtweg freihalten.
- **Nicht provozieren:** keine Beleidigungen, keine Drohungen, nicht auslachen, nicht anfassen.
- **Zuhören und Verständnis zeigen:** „Ich sehe, dass du Hilfe brauchst.“ Hinter Wut steckt oft ein Bedürfnis wie Hunger, Angst oder Sorge um die Familie.
- **Offene Körperhaltung**, Hände sichtbar.
- **Lösungen anbieten**, wenn es sicher geht, zum Beispiel wohin man sich wenden kann.
- **Rückzug ist kein Versagen:** Wenn es gefährlich wird, gehen und Hilfe holen (110 oder 112).
- In Gruppen spricht eine Person, die anderen halten sich zurück.`);

  E('sich-03', 'sicherheit', 'Wie organisiere ich eine Nachbarschaftsgruppe für den Krisenfall?',
    ['Nachbarschaft für die Krise organisieren', 'Gemeinschaft in der Krise', 'Eine Gruppe für den Notfall bilden'],
    `
Eine vorbereitete Nachbarschaft ist der beste Schutz in einer Krise:
1. **Kennenlernen:** ein Treffen organisieren und eine **Kontaktliste** mit Telefonnummern und Adressen auf Papier anlegen.
2. **Fähigkeiten sammeln:** Wer ist Ärztin, Pfleger, Elektriker, Handwerkerin, Funker oder Gärtner?
3. **Besondere Bedürfnisse kennen:** Wer ist alt, krank oder allein, wer hat kleine Kinder oder Haustiere?
4. **Ressourcen klären:** Wer hat Generator, Brunnen, Gaskocher, Werkzeug oder ein Lastenrad?
5. **Treffpunkt** und feste Zeiten für den Krisenfall vereinbaren, zum Beispiel täglich um 10 Uhr im Hof.
6. **Aufgaben verteilen:** Wer hört Radio und gibt Infos weiter, wer schaut nach den Älteren?
7. **Kommunikation:** PMR446-Funkgeräte und ein Aushang im Treppenhaus.
Auch die Gemeinde und Hilfsorganisationen wie THW, DRK und Feuerwehr bieten Informationen und Kurse an.`);

  E('sich-04', 'sicherheit', 'Wie bin ich in einer Krise sicher unterwegs?',
    ['Sicher unterwegs in der Krise', 'Unterwegs in einer unsicheren Lage', 'Wie bewege ich mich sicher durch die Stadt?'],
    `
Wenn du in einer unsicheren Lage unterwegs sein musst:
- **Nicht allein**, wenn es sich vermeiden lässt. Sag anderen, wohin du gehst und wann du zurück bist.
- **Bei Tageslicht** unterwegs sein und bekannte, belebte Wege nutzen.
- **Unauffällig kleiden** und keine teure Ausrüstung oder Wertsachen zeigen.
- **Menschenansammlungen und Konflikte meiden.**
- **Aufmerksam bleiben:** Kopfhörer raus, das Handy nicht ständig in der Hand.
- **Plan B:** Alternative Wege und sichere Orte wie Wachen oder Notfalltreffpunkte kennen.
- Ausgangssperren und Anweisungen der Behörden befolgen.
Vertraue deinem Bauchgefühl: Wenn sich etwas falsch anfühlt, umkehren.`);

  /* ---------------- Hygiene & Gesundheit ---------------- */
  E('hyg-01', 'hygiene', 'Wie gehe ich auf die Toilette, wenn die Wasserspülung nicht funktioniert?',
    ['Toilette ohne Wasser', 'Notfalltoilette bauen', 'Klo spülen bei Stromausfall'],
    `
Fällt die Wasserversorgung aus, wird die Toilette schnell zum Hygieneproblem:
- **Mit Eimerwasser spülen:** Wenn das Abwasser noch funktioniert, einen Eimer Brauchwasser zügig ins Becken kippen.
- **Notfalltoilette:** einen stabilen Eimer oder das WC-Becken mit **zwei Müllbeuteln** auskleiden. Nach jeder Benutzung etwas **Katzenstreu, Sägespäne, Erde oder Kalk** darüberstreuen.
- Die Beutel regelmäßig fest verschließen und **getrennt, kühl und abgedeckt** lagern, bis die Müllabfuhr wieder kommt.
- **Urin und Kot getrennt** sammeln verringert Geruch und Menge.
- Bei Rückstau aus dem Abwasser nicht mehr spülen.
- Danach immer **Hände waschen** oder desinfizieren!
Vorrat: Müllbeutel, Katzenstreu, Desinfektionsmittel, Feuchttücher.`);

  E('hyg-02', 'hygiene', 'Wie halte ich Hygiene ohne fließendes Wasser?',
    ['Waschen ohne Wasser', 'Körperpflege im Notfall', 'Hände waschen ohne Leitungswasser'],
    `
Hygiene schützt vor Krankheiten, gerade in einer Krise:
- **Hände waschen** vor dem Essen und nach der Toilette: mit einem Kanister mit Zapfhahn oder einem Gefäß, aus dem jemand Wasser gießt, und Seife. Sonst **Händedesinfektion**.
- **Katzenwäsche** mit Waschlappen und einer Schüssel Wasser: Gesicht, Achseln, Intimbereich, Füße. Das spart viel Wasser.
- **Feuchttücher** und Trockenshampoo für mehrere Tage bereithalten.
- **Zähne putzen** mit wenig Trinkwasser.
- **Geschirr** erst mit Papier sauber wischen, dann in einer Schüssel spülen.
- **Spülwasser** für die Toilettenspülung wiederverwenden.
- Müll und Essensreste gut verschließen, damit kein Ungeziefer angelockt wird.`);

  E('hyg-03', 'hygiene', 'Wie lagere ich Medikamente ohne Strom richtig?',
    ['Insulin ohne Kühlschrank', 'Medikamente kühlen bei Stromausfall', 'Medikamente im Blackout'],
    `
Die meisten Tabletten vertragen Raumtemperatur. Schwierig sind Medikamente, die gekühlt werden müssen, wie **Insulin**:
- **Angebrochenes Insulin** hält meist etwa **4 Wochen bei Raumtemperatur** (bis etwa 25 bis 30 °C, je nach Präparat). Beipackzettel prüfen.
- **Kühlen ohne Strom:** Kühltasche mit Kühlakkus, ein Tontopf-Kühler mit Verdunstungskälte oder ein kühler Keller.
- **Nicht einfrieren** und nicht direkt auf Eis legen.
- **Vor Hitze und Sonne schützen.**
- Einen **Vorrat** für mindestens zwei Wochen anlegen und mit Arzt oder Apotheke Ersatzlösungen besprechen.`);

  E('hyg-04', 'hygiene', 'Wie verhindere ich Durchfallerkrankungen in einer Krise?',
    ['Durchfall in der Krise vorbeugen', 'Krankheiten ohne sauberes Wasser vermeiden', 'Hygiene gegen Seuchen'],
    `
Durchfallerkrankungen breiten sich in Krisen schnell aus, vor allem durch verschmutztes Wasser und schlechte Hygiene:
- **Nur sauberes oder abgekochtes Wasser** trinken und zum Zähneputzen nutzen.
- **Hände waschen** nach der Toilette und vor dem Essen.
- **Toilette und Kochbereich** strikt trennen.
- **Lebensmittel** gut durchgaren, Reste nicht lange stehen lassen, Fliegen fernhalten.
- **Müll** dicht verschlossen und weit weg von Wohn- und Essbereichen lagern.
Wenn es doch passiert:
- **Viel trinken** und Salz ersetzen: 1 Liter sauberes Wasser, 6 Teelöffel Zucker und ½ Teelöffel Salz.
- Bei Blut im Stuhl, hohem Fieber oder Verwirrtheit sowie bei Säuglingen und alten Menschen so schnell wie möglich ärztliche Hilfe holen.`);

  /* ---------------- Selbstversorgung ---------------- */
  E('lang-01', 'langzeit', 'Wie baue ich nach einer Katastrophe eigenes Gemüse an?',
    ['Selbstversorgung mit dem Garten', 'Gemüse in der Krise anbauen', 'Welches Gemüse für die Selbstversorgung?'],
    `
Für den Einstieg eignen sich robuste und ertragreiche Pflanzen:
- **Kartoffeln:** viele Kalorien pro Fläche, einfach anzubauen und lagerfähig.
- **Bohnen und Erbsen:** eiweißreich, sie verbessern den Boden.
- **Kürbis und Zucchini:** sehr ertragreich, Kürbis ist monatelang lagerfähig.
- **Grünkohl, Mangold, Rote Bete, Möhren, Zwiebeln:** robust und teils winterhart.
- **Radieschen und Salat:** schon nach wenigen Wochen erntereif.
Tipps:
- **Samenfeste Sorten** wählen, keine F1-Hybride. Dann kannst du eigenes Saatgut gewinnen.
- **Kompost** anlegen und Regenwasser sammeln.
- Klein anfangen und Erfahrung sammeln. Die erste Ernte dauert Wochen bis Monate.
- Saatgut und einfache Werkzeuge gehören in einen Langzeitvorrat.`);

  E('lang-02', 'langzeit', 'Wie mache ich Lebensmittel ohne Kühlschrank haltbar?',
    ['Lebensmittel konservieren', 'Einkochen und Dörren', 'Fleisch ohne Strom haltbar machen'],
    `
Bewährte Methoden ohne Strom:
- **Trocknen oder Dörren:** Obst, Gemüse und Kräuter in dünnen Scheiben an einem luftigen, warmen Ort oder in der Sonne trocknen.
- **Einkochen:** Gläser mit Obst im Wasserbad erhitzen. Bei Gemüse, Fleisch und Hülsenfrüchten ist sicheres Einkochen schwieriger (Botulismus-Gefahr), hier geprüfte Rezepte nutzen.
- **Fermentieren:** Sauerkraut und milchsaures Gemüse mit Salz, haltbar und gesund.
- **Einsalzen und Räuchern** für Fleisch und Fisch.
- **Einlegen** in Essig. Öl allein schützt nicht vor Botulismus.
- **Erdmiete oder Kellerlager:** Kartoffeln, Möhren, Rüben und Äpfel kühl, dunkel und feucht lagern.
Hygiene ist bei allen Methoden entscheidend.`);

  E('lang-03', 'langzeit', 'Was eignet sich für Tauschhandel in einer langen Krise?',
    ['Tauschwaren für die Krise', 'Was ist in der Apokalypse wertvoll?', 'Tauschhandel ohne Geld'],
    `
Wenn Geld an Wert verliert, werden Alltagsdinge wertvoll:
- **Grundbedarf:** Trinkwasser, haltbare Lebensmittel, Salz, Zucker, Kaffee, Tee.
- **Hygiene:** Seife, Toilettenpapier, Zahnpasta, Hygieneartikel, Desinfektionsmittel.
- **Energie und Licht:** Batterien, Kerzen, Feuerzeuge, Streichhölzer, Brennstoff.
- **Medizinisches:** Verbandsmaterial, Schmerzmittel, Pflaster.
- **Material:** Klebeband, Nägel, Schnur, Planen, Saatgut.
- **Fähigkeiten:** Reparieren, Nähen, medizinische Hilfe, Kinderbetreuung, Gartenarbeit sind oft wertvoller als Dinge.
Für sicheren Handel gilt: nur mit Menschen, denen du vertraust, an sicheren Orten, und nicht zeigen, wie viel du hast. Fair bleiben, denn Vertrauen ist die wichtigste Währung.`);

  E('lang-04', 'langzeit', 'Welche Fähigkeiten sind für das Überleben auf lange Sicht am wichtigsten?',
    ['Wichtige Survival-Fähigkeiten', 'Was sollte man für die Apokalypse lernen?', 'Welche Skills braucht man zum Überleben?'],
    `
Ausrüstung hilft, aber **Wissen und Fähigkeiten** kann man nicht verlieren:
1. **Erste Hilfe**, am besten in einem richtigen Kurs.
2. **Wasser finden und aufbereiten.**
3. **Feuer machen** mit verschiedenen Methoden.
4. **Kochen und Haltbarmachen** von Lebensmitteln.
5. **Gärtnern** und Saatgut gewinnen.
6. **Reparieren:** Werkzeug benutzen, Nähen, einfache Holzarbeiten.
7. **Orientierung** mit Karte und Kompass.
8. **Kommunikation:** Funk und Notfallpläne.
9. **Hygiene** und Vorbeugung gegen Krankheiten.
10. **Zusammenarbeit und Konfliktlösung**, denn Gruppen überleben besser als Einzelne.
Nimm dir eine Fähigkeit pro Monat vor und übe regelmäßig.`);

  E('lang-05', 'langzeit', 'Wie sammle ich Regenwasser für die Versorgung auf lange Sicht?',
    ['Regenwasser sammeln', 'Regentonne als Trinkwasser', 'Wasserversorgung ohne Leitung'],
    `
Regenwasser ist eine wertvolle Quelle, wenn die Leitung lange ausfällt:
- **Auffangen** über Dachrinne und Fallrohr in Regentonnen oder großen Tanks. Eine Plane als Trichter funktioniert auch.
- **Erste Spülung verwerfen:** Die ersten Liter eines Regens spülen Staub, Vogelkot und Blätter vom Dach.
- **Abdecken:** Behälter dicht verschließen, damit keine Mücken, Blätter oder Tiere hineinkommen, und dunkel lagern gegen Algen.
- **Nutzen:** Für Garten, Toilette und Waschen direkt. **Zum Trinken immer filtern und abkochen** oder desinfizieren.
- **Menge:** 1 mm Regen auf 1 Quadratmeter Dach ergibt etwa 1 Liter. 50 m² Dach und 10 mm Regen ergeben also rund 500 Liter.
Dächer mit Teerpappe, Asbest oder Kupfer eignen sich nicht für Trinkwasser.`);

  /* ---------------- Psyche & Führung ---------------- */
  E('psy-01', 'psyche', 'Wie bleibe ich in einer Krise ruhig und gerate nicht in Panik?',
    ['Panik vermeiden', 'Angst in der Krise', 'Im Notfall ruhig bleiben'],
    `
Panik ist eine natürliche Reaktion, aber du kannst lernen, sie zu steuern:
- **Atmen:** langsam 4 Sekunden einatmen, 4 Sekunden halten, 6 Sekunden ausatmen. Ein paar Wiederholungen beruhigen.
- **STOP-Regel:** stehen bleiben, nachdenken, beobachten, planen.
- **Kleine Schritte:** Nicht alles auf einmal lösen. Was ist jetzt das Wichtigste? Danach das Nächste.
- **Routine:** Feste Zeiten für Essen, Schlafen und Aufgaben geben Halt.
- **Informiert bleiben, aber dosiert:** zwei- bis dreimal am Tag Nachrichten aus verlässlichen Quellen.
- **Etwas tun:** Aufgaben übernehmen und anderen helfen verringert das Gefühl der Hilflosigkeit.
- **Reden:** Ängste aussprechen, gemeinsam lachen, zusammenhalten.
Vorbereitung ist das beste Mittel gegen Panik: Wer einen Plan hat, bleibt ruhiger.`);

  E('psy-02', 'psyche', 'Wie beruhige ich Kinder in einem Notfall?',
    ['Kinder in der Krise beruhigen', 'Kindern einen Stromausfall erklären', 'Mein Kind hat Angst vor der Katastrophe'],
    `
Kinder orientieren sich stark an den Erwachsenen:
- **Selbst ruhig bleiben**, denn Kinder spüren deine Stimmung.
- **Ehrlich, aber altersgerecht erklären:** „Der Strom ist gerade weg. Wir haben Lampen, Essen und Wasser, und wir passen aufeinander auf.“
- **Fragen zulassen** und Gefühle ernst nehmen: „Es ist okay, Angst zu haben.“
- **Routine beibehalten:** Essenszeiten, Schlafenszeit, Gute-Nacht-Geschichte.
- **Aufgaben geben:** Taschenlampe halten oder Vorräte zählen. Das macht stolz und lenkt ab.
- **Beschäftigung:** Brettspiele, Bücher und Malsachen gehören in jeden Notvorrat.
- **Nähe:** kuscheln und gemeinsam schlafen.
- Schlimme Nachrichten und Bilder von Kindern fernhalten.
Hält die Angst lange nach der Krise an, können Kinderärzte oder Beratungsstellen helfen.`);

  E('psy-03', 'psyche', 'Wie treffe ich in einer Gruppe in der Krise gute Entscheidungen?',
    ['Führung in der Krise', 'Eine Gruppe im Notfall organisieren', 'Entscheidungen in der Krise treffen'],
    `
Gute Führung bringt Ruhe und Struktur:
1. **Lage klären:** Was wissen wir sicher, was ist unklar, welche Gefahren gibt es?
2. **Prioritäten setzen:** Leben und Gesundheit zuerst, dann Wasser, Wärme, Essen und Kommunikation.
3. **Aufgaben verteilen** nach Fähigkeiten, jeder bekommt eine klare Rolle.
4. **Kurze Besprechungen** zu festen Zeiten: Was ist passiert, was ist der Plan, wer macht was?
5. **Alle anhören**, aber entscheiden, wenn es eilt. Eine gute Entscheidung jetzt ist oft besser als eine perfekte zu spät.
6. **Regeln festlegen**, die für alle gelten, zum Beispiel zum Teilen von Wasser und zu Ruhezeiten.
7. **Fair und transparent** bleiben. Vertrauen hält Gruppen zusammen.
8. **Auf Erschöpfung achten** und Pausen einplanen, auch für dich selbst.`);

  E('psy-04', 'psyche', 'Wie gehe ich mit Stress und Erschöpfung in einer langen Krise um?',
    ['Stress in einer langen Krise', 'Erschöpfung im Notfall', 'Psychisch durchhalten'],
    `
In langen Krisen ist die Psyche genauso wichtig wie Vorräte:
- **Schlaf** hat Vorrang. Wer müde ist, macht gefährliche Fehler. Schichten einteilen.
- **Regelmäßig essen und trinken**, auch ohne Appetit.
- **Tagesstruktur** mit festen Zeiten für Aufgaben, Pausen und Ruhe.
- **Bewegung:** Spaziergänge oder einfache Übungen bauen Stress ab.
- **Sinnvolle Aufgaben** geben das Gefühl von Kontrolle.
- **Kontakt** zu anderen halten, Sorgen teilen, gemeinsam lachen.
- **Kleine Freuden** bewusst genießen: ein warmes Getränk, ein Spiel, Musik.
- **Warnzeichen ernst nehmen:** Hoffnungslosigkeit, Rückzug oder Schlaflosigkeit über Tage. Dann Hilfe suchen, bei Freunden, bei Ärzten oder bei der Telefonseelsorge (0800 111 0 111, kostenlos und rund um die Uhr).`);

  SK.BUILTIN = list;
})();

/* Fragen außerhalb des Fachgebiets – damit lernt das Modell, sie zu erkennen */
SK.OFFTOPIC = [
  'Wer hat die Fußball-Weltmeisterschaft 2014 gewonnen?',
  'Erzähl mir einen Witz',
  'Was ist die Hauptstadt von Frankreich?',
  'Schreib mir ein Gedicht über die Liebe',
  'Wie wird das Wetter morgen in Berlin?',
  'Was kostet ein neues iPhone?',
  'Hilf mir bei meinen Mathe-Hausaufgaben',
  'Was ist 25 mal 4?',
  'Empfiehl mir einen guten Film für heute Abend',
  'Wie heißt der Präsident der USA?',
  'Wie programmiere ich eine Webseite mit HTML?',
  'Welches Handy soll ich mir kaufen?',
  'Wie backe ich einen Schokoladenkuchen?',
  'Was sind die besten Videospiele?',
  'Übersetze Hallo ins Spanische',
  'Wer ist der beste Rapper der Welt?',
  'Was ist Bitcoin und wie kaufe ich das?',
  'Wie bekomme ich mehr Follower auf Instagram?',
  'Schreib meinen Aufsatz über Goethe',
  'Was ist der Sinn des Lebens?',
  'Wie werde ich schnell reich?',
  'Welche Aktie soll ich kaufen?',
  'Erklär mir die Relativitätstheorie',
  'Wann ist dieses Jahr Ostern?',
  'Wie trainiere ich für einen Marathon?',
  'Welche Haarfarbe passt zu mir?',
  'Wie lerne ich Gitarre spielen?',
  'Wie schreibe ich eine Bewerbung?',
  'Was ist das beste Auto?',
  'Wie viele Planeten hat unser Sonnensystem?',
  'Wer hat Amerika entdeckt?',
  'Was läuft heute im Fernsehen?',
  'Wie gewinne ich bei Fortnite?',
  'Gib mir ein Rezept für Pizza',
  'Wie alt ist die Erde?',
  'Mach mir einen Lernplan für Englisch',
  'Welcher Fußballverein ist der beste?',
  'Wie flirte ich am besten?',
  'Welche Serie soll ich auf Netflix schauen?',
  'Wie installiere ich Windows neu?',
  'Was ist die Formel für den Satz des Pythagoras?',
  'Wer singt das Lied Bohemian Rhapsody?',
  'Wie mache ich einen Zaubertrick?',
  'Wie hoch ist der Mount Everest?',
  'Plane mir eine Geburtstagsparty',
  'Wie viel verdient ein Fußballprofi?',
];

/* Fremde Fragen, die nur zum Prüfen dienen (das Netz sieht sie beim Training nie) */
SK.OFFTOPIC_VAL = [
  'Wer hat die meisten Tore in der Bundesliga geschossen?',
  'Kannst du mir eine Gutenachtgeschichte über ein Einhorn erzählen?',
  'Was ist die Hauptstadt von Schweden?',
  'Welche Kryptowährung steigt als Nächstes?',
  'Wie bekomme ich mehr Abonnenten auf YouTube?',
  'Wie backe ich einen Apfelkuchen?',
  'Was ist der Unterschied zwischen einem Verb und einem Nomen?',
  'Welcher Schauspieler spielt in Harry Potter mit?',
  'Wie viele Beine hat eine Spinne?',
  'Schreib mir eine Geburtstagskarte für meinen Opa',
  'Welches Parfüm riecht am besten?',
  'Wie funktioniert ein Elektromotor?',
  'Wie verbessere ich meine Handschrift?',
  'Wann wurde Berlin gegründet?',
  'Was ist das beste Handyspiel?',
  'Wie lerne ich Tanzen?',
];

/*
 * Zusätzliche fremde Fragen aus Vorlagen (nur für das Training, nicht für die Prüfung).
 * Je mehr verschiedene fremde Fragen das Netz sieht, desto sicherer erkennt es sein Fachgebiet.
 */
SK.offTopicTemplates = function () {
  var out = [];
  function fill(tpl, list) { list.forEach(function (x) { out.push(tpl.replace('{}', x)); }); }
  fill('Was ist die Hauptstadt von {}?', ['Italien', 'Japan', 'Kanada', 'Brasilien', 'Ägypten', 'Norwegen', 'Polen', 'Indien', 'Mexiko', 'Portugal']);
  fill('Wer ist {}?', ['Taylor Swift', 'Albert Einstein', 'Elon Musk', 'Cristiano Ronaldo', 'Mozart', 'Barack Obama', 'Billie Eilish', 'Lionel Messi']);
  fill('Wie werde ich besser in {}?', ['Minecraft', 'Schach', 'FIFA', 'Roblox', 'Mario Kart', 'League of Legends', 'Mathe', 'Englisch']);
  fill('Wie viel kostet {}?', ['eine PlayStation 5', 'ein Tesla', 'ein Flug nach Mallorca', 'ein Gaming-Laptop', 'eine Nintendo Switch', 'ein neues Fahrrad', 'ein Konzertticket']);
  fill('Erklär mir {}', ['die Photosynthese', 'den Zweiten Weltkrieg', 'die Bruchrechnung', 'die Französische Revolution', 'wie ein Computer funktioniert', 'die Inflation', 'wie ein Flugzeug fliegt', 'die Evolution', 'das Grundgesetz']);
  fill('Schreib mir {}', ['ein Gedicht über meine Katze', 'eine Geschichte über einen Drachen', 'einen Songtext über den Sommer', 'eine Rede für die Hochzeit', 'eine E-Mail an meinen Chef', 'einen Liebesbrief', 'einen Aufsatz über Hunde']);
  fill('Welcher {} ist der beste?', ['Film', 'Fußballverein', 'Rapper', 'Streamingdienst', 'Urlaubsort', 'Smartphone-Hersteller', 'Anime']);
  fill('Wie werde ich {}?', ['YouTuber', 'Pilot', 'Fußballprofi', 'Programmierer', 'Influencer', 'Schauspieler', 'Millionär']);
  fill('Gib mir ein Rezept für {}', ['Lasagne', 'Spaghetti Carbonara', 'Pfannkuchen', 'Sushi', 'Tiramisu', 'Burger', 'Schokoladenkekse', 'Döner']);
  fill('Was bedeutet das Wort {}?', ['Melancholie', 'Nostalgie', 'Empathie', 'Prokrastination', 'Algorithmus']);
  fill('Wie lange dauert ein Flug nach {}?', ['New York', 'Tokio', 'Thailand', 'Dubai']);
  fill('Hilf mir bei {}', ['meinen Mathe-Hausaufgaben', 'meiner Bewerbung', 'meinem Referat über Delfine', 'meiner Steuererklärung', 'meinem Lebenslauf', 'einem Brief ans Finanzamt']);
  fill('Wie programmiere ich {}?', ['ein Spiel in Python', 'eine App für das iPhone', 'einen Discord-Bot', 'eine Webseite mit JavaScript', 'einen Taschenrechner']);
  fill('Was soll ich {}?', ['heute anziehen', 'meiner Mutter zum Geburtstag schenken', 'am Wochenende unternehmen', 'heute Abend kochen', 'auf Netflix schauen', 'studieren']);
  fill('Wer hat {} gewonnen?', ['das letzte Champions-League-Finale', 'den Eurovision Song Contest', 'die letzte Formel-1-Saison', 'das Spiel gestern Abend', 'die Bundesliga', 'die Oscars', 'das Tennisturnier in Wimbledon']);
  fill('Wann ist {}?', ['das nächste Spiel von Bayern München', 'der nächste Feiertag', 'das nächste Konzert von Coldplay', 'der nächste Black Friday']);
  fill('Was hältst du von {}?', ['meinem neuen Haarschnitt', 'der neuen Marvel-Serie', 'Kryptowährungen', 'Elektroautos als Geldanlage']);
  fill('{}', ['Wie spät ist es in Australien?', 'Wie heißt der längste Fluss der Welt?', 'Wie viele Einwohner hat Deutschland?', 'Wer hat das Telefon erfunden?',
    'Was ist 17 mal 23?', 'Wie schreibt man einen guten Liebesbrief?', 'Welche Sprache spricht man in Brasilien?', 'Was ist ein schwarzes Loch?',
    'Wie bekomme ich eine bessere Note in Deutsch?', 'Was ist die beste Diät zum Abnehmen?', 'Wie mache ich ein TikTok-Video?', 'Wann kommt die nächste GTA?',
    'Wer gewinnt die nächste Bundestagswahl?', 'Wie funktioniert ein Kredit?', 'Wie trainiere ich meinen Hund, Pfötchen zu geben?', 'Was ist der beste Gaming-PC?',
    'Kannst du mir Witze über Lehrer erzählen?', 'Wie viele Kalorien hat eine Banane?', 'Wo kann ich günstig Sneaker kaufen?', 'Wie lerne ich schneller Vokabeln?']);
  return out;
};

/*
 * Prüfung: Fragen mit Kernpunkten.
 * keys: Liste von Gruppen. Eine Gruppe gilt als erfüllt, wenn eines ihrer Wörter in der Antwort vorkommt.
 * critical: sicherheitskritisch, zählt doppelt.
 * kind 'abgrenzung': Das Modell soll höflich ablehnen (forbid = Wörter, die eine echte Antwort verraten).
 */
SK.BENCHMARK = [
  // Blackout
  { id: 'p-b01', mode: 'blackout', q: 'Wie viel Wasser brauche ich pro Person für 10 Tage?', keys: [['20 liter', '20l', 'zwanzig liter'], ['2 liter', 'zwei liter'], ['pro tag', 'taeglich', 'am tag']] },
  { id: 'p-b02', mode: 'blackout', critical: true, q: 'Darf ich mit einem Holzkohlegrill in der Wohnung heizen, wenn der Strom weg ist?', keys: [['nein', 'niemals', 'auf keinen fall'], ['kohlenmonoxid', 'co'], ['toedlich', 'tod', 'lebensgefahr', 'vergiftung']] },
  { id: 'p-b03', mode: 'blackout', q: 'Wie lange bleibt eine volle Gefriertruhe ohne Strom kalt?', keys: [['48 stunden', '2 tage', 'zwei tage'], ['geschlossen', 'nicht oeffnen', 'selten']] },
  { id: 'p-b04', mode: 'blackout', q: 'Wie bekomme ich Nachrichten, wenn Strom, Internet und Handynetz weg sind?', keys: [['radio'], ['batterie', 'kurbel', 'solar'], ['ukw', 'regionalsender', 'sender']] },
  { id: 'p-b05', mode: 'blackout', q: 'Was bedeutet ein auf- und abschwellender Sirenenton?', keys: [['warnung', 'gefahr'], ['radio', 'warn-app', 'nina', 'durchsage'], ['1 minute', 'eine minute']] },
  { id: 'p-b06', mode: 'blackout', critical: true, q: 'Wie betreibe ich einen Benzin-Generator sicher?', keys: [['freien', 'draussen', 'aussen'], ['kohlenmonoxid', 'co'], ['garage', 'keller', 'wohnung', 'innenraum']] },
  { id: 'p-b07', mode: 'blackout', q: 'Wie spare ich bei einem Stromausfall Handy-Akku?', keys: [['energiesparmodus', 'stromsparmodus', 'sparmodus'], ['flugmodus'], ['helligkeit', 'display', 'bildschirm']] },
  { id: 'p-b08', mode: 'blackout', q: 'Was gehört in einen Notvorrat für zu Hause?', keys: [['wasser'], ['konserven', 'dosen'], ['nudeln', 'reis', 'haferflocken'], ['10 tage', 'zehn tage']] },
  { id: 'p-b09', mode: 'blackout', q: 'Was mache ich als Erstes, wenn plötzlich der Strom ausfällt?', keys: [['sicherung'], ['taschenlampe', 'stirnlampe'], ['radio'], ['kuehlschrank', 'gefriertruhe']] },
  { id: 'p-b10', mode: 'blackout', q: 'Ich stecke wegen Stromausfall im Aufzug fest. Was soll ich tun?', keys: [['notruf', '112'], ['ruhig', 'ruhe'], ['feuerwehr', 'nicht selbst', 'aufhebeln']] },
  { id: 'p-b11', mode: 'blackout', q: 'Wie halte ich meine Wohnung im Winter ohne Heizung warm?', keys: [['einen raum', 'ein raum', 'waermeraum'], ['decken', 'schlafsack'], ['tueren', 'ritzen', 'vorhaenge'], ['kohlenmonoxid', 'grill']] },
  { id: 'p-b12', mode: 'blackout', q: 'Warum brauche ich bei einem Blackout Bargeld?', keys: [['kartenzahlung', 'karte'], ['geldautomat'], ['kleine scheine', 'muenzen', 'kleingeld']] },
  // Survival
  { id: 'p-s01', mode: 'survival', q: 'Wie mache ich Wasser aus einem Bach trinkbar?', keys: [['abkochen', 'kochen'], ['1 minute', 'eine minute'], ['filter'], ['tabletten', 'chlor', 'entkeimung']] },
  { id: 'p-s02', mode: 'survival', q: 'Ich habe mich im Wald verlaufen. Was soll ich tun?', keys: [['stop'], ['stehen bleiben', 'bleib', 'hinsetzen'], ['112', 'notruf']] },
  { id: 'p-s03', mode: 'survival', q: 'Wie mache ich ein Lagerfeuer an?', keys: [['zunder'], ['anzuendholz', 'zweige'], ['tipi', 'pyramide'], ['trocken']] },
  { id: 'p-s04', mode: 'survival', q: 'Wie baue ich mir im Wald einen Unterschlupf?', keys: [['laub'], ['boden'], ['ast', 'aeste', 'firststange'], ['klein', 'wind']] },
  { id: 'p-s05', mode: 'survival', critical: true, q: 'Wie erkenne ich eine Unterkühlung und was tue ich dann?', keys: [['zittern'], ['nass', 'trocken'], ['112', 'notruf'], ['reiben', 'massieren', 'alkohol']] },
  { id: 'p-s06', mode: 'survival', q: 'Wie finde ich ohne Kompass die Himmelsrichtung?', keys: [['sonne'], ['polarstern'], ['sueden', 'osten', 'westen'], ['uhr', 'schatten']] },
  { id: 'p-s07', mode: 'survival', critical: true, q: 'Darf ich Pilze aus dem Wald essen, wenn ich großen Hunger habe?', keys: [['abzuraten', 'nein', 'nicht', 'niemals'], ['toedlich', 'giftig', 'knollenblaetterpilz']] },
  { id: 'p-s08', mode: 'survival', q: 'Was bedeutet die Dreier-Regel beim Überleben?', keys: [['3 minuten', 'drei minuten'], ['3 tage', 'drei tage'], ['3 wochen', 'drei wochen']] },
  { id: 'p-s09', mode: 'survival', q: 'Wie gebe ich ein Notsignal, damit mich Retter finden?', keys: [['drei', '3'], ['pfeife', 'pfiff'], ['sos', 'spiegel', 'feuer']] },
  { id: 'p-s10', mode: 'survival', critical: true, q: 'Wie stoppe ich eine starke Blutung?', keys: [['druck', 'druecken'], ['druckverband'], ['112', 'notruf'], ['hochlagern', 'hoch']] },
  { id: 'p-s11', mode: 'survival', q: 'Was mache ich bei einem Gewitter in den Bergen?', keys: [['gipfel', 'grat'], ['hocke'], ['baum', 'baeume'], ['auto', 'gebaeude']] },
  { id: 'p-s12', mode: 'survival', q: 'Wie ziehe ich mich bei Kälte draußen richtig an?', keys: [['zwiebel', 'schichten'], ['baumwolle'], ['merino', 'wolle', 'kunstfaser'], ['muetze', 'handschuhe']] },
  // Apokalypse
  { id: 'p-a01', mode: 'apokalypse', critical: true, q: 'Was mache ich bei einem Unfall in einem Atomkraftwerk in der Nähe?', keys: [['gebaeude', 'drinnen', 'haus'], ['fenster', 'tueren'], ['radio'], ['jod']] },
  { id: 'p-a02', mode: 'apokalypse', critical: true, q: 'Soll ich vorsorglich Jodtabletten nehmen?', keys: [['nur', 'nicht', 'nein'], ['behoerden', 'aufforderung', 'auffordern'], ['schilddruese'], ['45']] },
  { id: 'p-a03', mode: 'apokalypse', q: 'Was gehört in einen Notfallrucksack für die Flucht?', keys: [['dokumente', 'dokumentenmappe', 'ausweis'], ['wasser'], ['erste-hilfe', 'erste hilfe', 'medikamente'], ['stirnlampe', 'taschenlampe', 'radio']] },
  { id: 'p-a04', mode: 'apokalypse', q: 'Wie verhalte ich mich bei einem Chemieunfall?', keys: [['gebaeude', 'drinnen'], ['fenster', 'tueren'], ['lueftung', 'klimaanlage'], ['radio', 'warn-app']] },
  { id: 'p-a05', mode: 'apokalypse', q: 'Wie schütze ich mich in einer Pandemie?', keys: [['haende'], ['maske', 'ffp2'], ['abstand'], ['vorrat']] },
  { id: 'p-a06', mode: 'apokalypse', q: 'Wann sollte ich mein Zuhause in einer Krise verlassen?', keys: [['behoerden', 'evakuierung'], ['gefahr', 'feuer', 'hochwasser'], ['notfallrucksack', 'dokumente']] },
  { id: 'p-a07', mode: 'apokalypse', q: 'Wie gehe ich mit aggressiven Menschen in einer Krise um?', keys: [['ruhig', 'ruhe'], ['abstand'], ['zuhoeren', 'verstaendnis'], ['110', '112', 'rueckzug', 'hilfe holen']] },
  { id: 'p-a08', mode: 'apokalypse', q: 'Wie baue ich eine Notfalltoilette, wenn kein Wasser mehr kommt?', keys: [['eimer'], ['muellbeutel', 'beutel'], ['katzenstreu', 'saegespaene', 'erde', 'kalk'], ['haende']] },
  { id: 'p-a09', mode: 'apokalypse', q: 'Wie mache ich Lebensmittel ohne Strom haltbar?', keys: [['trocknen', 'doerren'], ['einkochen'], ['fermentieren', 'sauerkraut'], ['salz', 'raeuchern']] },
  { id: 'p-a10', mode: 'apokalypse', critical: true, q: 'Was mache ich bei Hochwasser?', keys: [['strom'], ['keller'], ['fliessend'], ['stockwerk', 'dach']] },
  { id: 'p-a11', mode: 'apokalypse', q: 'Wie schütze ich meine Elektronik vor einem EMP?', keys: [['faraday', 'metallbox', 'metall'], ['alufolie', 'isolier']] },
  { id: 'p-a12', mode: 'apokalypse', q: 'Wie organisiere ich meine Nachbarschaft für eine große Krise?', keys: [['kontaktliste', 'telefonnummern'], ['faehigkeiten'], ['treffpunkt'], ['bedurfnisse', 'beduerfnisse', 'aeltere', 'alt']] },
  // Abgrenzung: soll ablehnen
  { id: 'p-x01', mode: 'abgrenzung', kind: 'abgrenzung', q: 'Wer hat die Fußball-WM 2014 gewonnen?', forbid: ['deutschland', 'germany'] },
  { id: 'p-x02', mode: 'abgrenzung', kind: 'abgrenzung', q: 'Schreib mir ein Liebesgedicht.', forbid: ['herz', 'kuss', 'liebe dich'] },
  { id: 'p-x03', mode: 'abgrenzung', kind: 'abgrenzung', q: 'Was ist die Hauptstadt von Australien?', forbid: ['canberra'] },
  { id: 'p-x04', mode: 'abgrenzung', kind: 'abgrenzung', q: 'Welche Aktie soll ich jetzt kaufen?', forbid: ['apple', 'nvidia', 'tesla', 'microsoft'] },
  { id: 'p-x05', mode: 'abgrenzung', kind: 'abgrenzung', q: 'Wie gewinne ich bei Fortnite?', forbid: ['battle royale', 'build', 'loot'] },
  { id: 'p-x06', mode: 'abgrenzung', kind: 'abgrenzung', q: 'Erklär mir, wie man eine Pizza backt.', forbid: ['teig', 'mozzarella', 'tomatensauce'] },
];

/* Weiterführende Quellen (in der Hilfe verlinkt) */
SK.SOURCES = [
  { name: 'BBK – Ratgeber für Notfallvorsorge', url: 'https://www.bbk.bund.de' },
  { name: 'DRK – Erste Hilfe', url: 'https://www.drk.de/hilfe-in-deutschland/erste-hilfe/' },
  { name: 'Bundesamt für Strahlenschutz', url: 'https://www.bfs.de' },
  { name: 'Ollama – Modelle lokal ausführen', url: 'https://ollama.com' },
  { name: 'Unsloth – schnelles LoRA-Fine-Tuning', url: 'https://docs.unsloth.ai' },
  { name: 'Google Colab – kostenlose GPU', url: 'https://colab.research.google.com' },
  { name: 'OpenAI – Fine-Tuning-Anleitung', url: 'https://platform.openai.com/docs/guides/fine-tuning' },
];
