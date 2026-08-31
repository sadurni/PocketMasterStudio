// pmmap.js — port of gen_m50_map.py (map_Best50.html + map_Best50_print.html).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PMMap = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const esc = (x) => String(x)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  const DATA = String.raw`
# --- classic 60s/70s ---
The Byrds|Mr. Tambourine Man|2|jangly Rickenbacker
The Beatles|A Hard Day's Night|2|bright AC30 chord
The Police|Message in a Bottle|3|clean with JC-120 chorus
Fleetwood Mac|Albatross|7|dreamy clean tremolo
Buffalo Springfield|For What It's Worth|1|clean Fender harmonics
The Rolling Stones|Gimme Shelter|1|clean with tremolo
The Doors|Break On Through|8|jazzy clean Fender
Steely Dan|Reelin' in the Years|29|precise clean-dirty solo
Jeff Beck|Cause We've Ended as Lovers|26|smooth clean Strat lead
The Beatles|The Wind Cries Mary|26|clean Strat ballad
Grateful Dead|Fire on the Mountain|26|fluid clean Twin lead
Eagles|Take It Easy|4|clean country Telecaster
The Rolling Stones|Brown Sugar|13|raw open-G crunch
Creedence Clearwater Revival|Fortunate Son|13|raw swampy crunch
ZZ Top|La Grange|35|broken-up Fender boogie
Lynyrd Skynyrd|Sweet Home Alabama|4|clean country-rock
Bad Company|Can't Get Enough|16|punchy Marshall crunch
T. Rex|Get It On|16|greasy glam crunch
David Bowie|The Jean Genie|16|raw riff with crunch
The Kinks|You Really Got Me|15|proto-distortion chords
The Who|Won't Get Fooled Again|15|powerful Hiwatt chords
Deep Purple|Smoke on the Water|15|thick Marshall riff
Free|All Right Now|13|dry Kossoff crunch riff
Mountain|Mississippi Queen|15|thick Marshall crunch
Led Zeppelin|Immigrant Song|15|relentless Plexi riff
Steppenwolf|Born to Be Wild|15|gritty biker crunch
David Bowie|Ziggy Stardust|15|Ronson Marshall maxed out
Eagles|Life in the Fast Lane|17|Joe Walsh crunch riff
Thin Lizzy|Jailbreak|17|driving Marshall riff
Boston|More Than a Feeling|12|bright clean in chorus
The Who|Baba O'Riley|17|big Hiwatt chords
Black Sabbath|War Pigs|18|Iommi boosted riff
Black Sabbath|Children of the Grave|18|galloping boosted riff
Black Sabbath|Sweet Leaf|25|low-tuned sludge fuzz
Blue Cheer|Summertime Blues|25|proto-metal wall of fuzz
T. Rex|20th Century Boy|19|fat fuzz riff
The Yardbirds|Heart Full of Soul|14|catchy fuzz riff
Jimi Hendrix|Purple Haze|49|Octavia Fuzz Face
Jimi Hendrix|Foxy Lady|49|Fuzz Face rhythm
Cream|Sunshine of Your Love|15|Plexi woman-tone riff
Derek and the Dominos|Layla|41|cranked Marshall riff
The Allman Brothers Band|Jessica|29|melodic Les Paul lead
The Beatles|While My Guitar Gently Weeps|29|Clapton Les Paul lead
Peter Frampton|Do You Feel Like We Do|29|Marshall talkbox lead
Led Zeppelin|Since I've Been Loving You|41|fiery blues solo
Lynyrd Skynyrd|Free Bird|41|sweeping outro solo
The Allman Brothers Band|Whipping Post|41|intense Marshall solo
Thin Lizzy|The Boys Are Back in Town|41|harmonized Marshall leads
Deep Purple|Highway Star|41|neoclassical Marshall solo
Aerosmith|Dream On|41|building Marshall solo
David Bowie|Moonage Daydream|41|howling Ronson solo
Jimi Hendrix|All Along the Watchtower|41|wah and Plexi solos
Neil Young|Cinnamon Girl|35|dirty Old Black tweed
Santana|Black Magic Woman|28|singing sustained lead
Queen|Tie Your Mother Down|40|May treble-booster crunch
Faces|Stay with Me|37|Bassman slide/lead
Rainbow|Stargazer|44|epic boosted Blackmore solo
Deep Purple|Burn|42|boosted Marshall solo
Grand Funk Railroad|We're an American Band|16|Marshall boogie crunch
The Who|My Generation|13|raw power chords
Cream|Crossroads|41|cranked Plexi solo

# --- hard rock / metal ---
AC/DC|Highway to Hell|13|classic JTM45 crunch
AC/DC|Thunderstruck|13|bright Marshall picking
AC/DC|Let There Be Rock|39|raw JTM45 solo
Judas Priest|Breaking the Law|17|dry JCM800 riff
Judas Priest|Living After Midnight|17|straight 800 hard rock
Judas Priest|Painkiller|21|super-high-gain Mesa
Guns N' Roses|Welcome to the Jungle|17|rhythmic 800 sleaze
Motley Crue|Kickstart My Heart|17|fast glam 800
Def Leppard|Photograph|17|polished arena 800
Ratt|Round and Round|17|800 glam metal
Dio|Holy Diver|17|dark metal 800
Bon Jovi|You Give Love a Bad Name|17|radio hard-rock 800
Ozzy Osbourne|Crazy Train|17|bright Marshall riff
Motorhead|Ace of Spades|17|raw fast 800
Extreme|Get the Funk Out|17|800 funk metal
Scorpions|Rock You Like a Hurricane|20|powerful boosted 800
Motley Crue|Shout at the Devil|20|dark boosted 800
Iron Maiden|The Trooper|22|galloping boosted 800
Iron Maiden|Run to the Hills|22|epic boosted 800
Megadeth|Holy Wars|22|sharp boosted thrash 800
Slayer|Angel of Death|22|brutal boosted thrash 800
Anthrax|Caught in a Mosh|20|staccato boosted 800
Megadeth|Symphony of Destruction|20|heavy mid boosted 800
Metallica|Enter Sandman|21|massive Mesa palm-mute
Metallica|Battery|21|precise Mesa thrash
Metallica|One|21|climbing Mesa riff
Slayer|Raining Blood|21|fast Mesa chaos
Pantera|Cowboys from Hell|21|modern high gain
Pantera|Walk|21|spat heavy groove
Alice in Chains|Them Bones|21|dense low-tuned riff
Dream Theater|Pull Me Under|21|Mesa prog metal
Metallica|Fade to Black|5|melancholic clean arpeggios
Pantera|Cemetery Gates|8|clean intro with chorus
Ozzy Osbourne|Mama I'm Coming Home|7|warm clean tweed
Ozzy Osbourne|Mr. Crowley|44|neoclassical Marshall solo
Randy Rhoads|Crazy Train (solo)|44|bright boosted solo
Yngwie Malmsteen|Far Beyond the Sun|43|neoclassical shred sustain
Zakk Wylde|No More Tears (solo)|44|boosted Marshall sustain
Jake E. Lee|Bark at the Moon|44|aggressive boosted solo
Iron Maiden|Aces High|44|boosted twin solos
Michael Schenker|Doctor Doctor|41|Plexi solo with wah
George Lynch|Mr. Scary|47|expressive Soldano shred
Vito Bratta|Wait|47|melodic high-gain shred
John Petrucci|The Spirit Carries On|47|singing Soldano solo
ZZ Top|Sharp Dressed Man|17|Texan Marshall crunch
Kiss|Detroit Rock City|15|Plexi hard rock
Aerosmith|Walk This Way|15|funky Plexi riff

# --- blues / roots ---
Dire Straits|Money for Nothing|15|thick riff fixed wah
Allman Brothers|Ramblin' Man|29|clean-dirty country-rock
Lynyrd Skynyrd|Simple Man|15|slow Marshall riff
Eric Clapton|Cocaine|13|Marshall crunch riff
John Mayall Bluesbreakers|All Your Love|13|Bluesbreaker JTM45 crunch
ZZ Top|Tush|13|short boogie crunch
Rory Gallagher|Bad Penny|13|Strat Marshall crunch
Joe Bonamassa|Just Got Paid|17|powerful crunch riff
Creedence Clearwater Revival|Green River|35|broken-up swamp Fender
Stevie Ray Vaughan|Pride and Joy|35|pushed Texan Fender
George Thorogood|Move It On Over|35|raw tweed boogie
Muddy Waters|Mannish Boy|35|broken-up Chicago blues
Freddie King|Hide Away|35|broken-up Fender instrumental
Stevie Ray Vaughan|Texas Flood|34|pushed Fender solo
Buddy Guy|Damn Right I've Got the Blues|34|pushed wild Strat
Creedence Clearwater Revival|Born on the Bayou|34|pushed dark swamp
John Mayer|Slow Dancing in a Burning Room|34|pushed warm solo
Albert King|Born Under a Bad Sign|34|pushed thick solo
The Black Keys|Lonely Boy|14|garage fuzz riff
Stevie Ray Vaughan|Cold Shot|1|clean Strat funk
Eric Clapton|I Shot the Sheriff|1|clean funky reggae
Robert Cray|Smoking Gun|1|modern clean Strat
Doobie Brothers|Long Train Runnin'|1|rhythmic clean funk
B.B. King|Every Day I Have the Blues|4|clean Fender swing
T-Bone Walker|Stormy Monday|4|clean jazz-blues
Stevie Ray Vaughan|Lenny|11|clean Fender ballad
Dire Straits|Romeo and Juliet|11|bright clean arpeggios
The Band|The Weight|11|clean Americana
Bonnie Raitt|I Can't Make You Love Me|11|clean ballad
Chuck Berry|Johnny B. Goode|6|rock'n'roll tweed twang
Eric Clapton|Wonderful Tonight|26|melodic clean solo
John Mayer|Gravity|26|slow melodic solo
B.B. King|The Thrill Is Gone|26|sweet clean solo
Roy Buchanan|Sweet Dreams|26|weeping Tele solo
Gary Moore|Still Got the Blues|28|weeping sustain solo
Santana|Samba Pa Ti|28|cantabile sustain solo
Joe Bonamassa|Sloe Gin|28|epic sustain solo
Robben Ford|Talk to Your Daughter|28|smooth sustain solo
Eric Johnson|Cliffs of Dover|31|smooth liquid legato
Fleetwood Mac|Black Magic Woman|29|moody clean-dirty solo
Derek and the Dominos|Bell Bottom Blues|29|sweet clean-dirty solo
Cream|White Room|49|Plexi wah solo
Robin Trower|Bridge of Sighs|27|univibe fuzz solo
Duane Allman|Statesboro Blues|37|Southern Bassman slide
Bonnie Raitt|Something to Talk About|37|clean roots slide
Elmore James|Dust My Broom|37|raw classic slide
George Thorogood|Bad to the Bone|30|dirty Marshall slide
Little Feat|Dixie Chicken|30|pushed greasy slide
Gary Moore|Parisienne Walkways|28|violin-sustain vibrato
Peter Frampton|Show Me the Way|29|Marshall talkbox lead

# --- alternative / grunge ---
Nirvana|Smells Like Teen Spirit|17|punchy JCM800 rhythm
Nirvana|Come as You Are|8|clean with chorus
Nirvana|Heart-Shaped Box|19|crunch to muffy fuzz
Nirvana|In Bloom|17|JCM800 grunge rhythm
Nirvana|Lithium|13|dynamic clean-crunch
Pearl Jam|Alive|48|melodic Marshall solo
Pearl Jam|Even Flow|17|funky JCM800 rhythm
Pearl Jam|Black|11|clean arpeggiated
Pearl Jam|Yellow Ledbetter|8|Hendrix-style clean
Soundgarden|Black Hole Sun|36|dense Bogner solo
Soundgarden|Spoonman|20|heavy drop Marshall
Soundgarden|Rusty Cage|21|drop thrash riff
Alice in Chains|Would?|20|dark heavy riff
Alice in Chains|Man in the Box|18|boosted talkbox riff
Alice in Chains|Rooster|36|dense Bogner solo
Stone Temple Pilots|Plush|13|mid-gain grunge crunch
Stone Temple Pilots|Interstate Love Song|8|warm clean
Stone Temple Pilots|Vasoline|17|JCM800 riff
Rage Against the Machine|Killing in the Name|21|heavy scooped drop
Rage Against the Machine|Bulls on Parade|21|thrash groove riff
Rage Against the Machine|Guerrilla Radio|18|funky boosted riff
Audioslave|Cochise|20|heavy Marshall boost
Audioslave|Like a Stone|11|clean arpeggiated
Red Hot Chili Peppers|Under the Bridge|8|melodic clean
Red Hot Chili Peppers|Can't Stop|3|funky clean jangle
Red Hot Chili Peppers|Snow|3|bright clean arpeggio
Red Hot Chili Peppers|By the Way|17|Marshall chorus crunch
Foo Fighters|Everlong|19|fuzz-muff wall
Foo Fighters|Monkey Wrench|17|powerful JCM800 rhythm
Foo Fighters|The Pretender|20|heavy Marshall riff
Foo Fighters|Times Like These|13|dynamic crunch
Radiohead|Creep|17|explosive crunch hit
Radiohead|Paranoid Android|33|expressive TubeScreamer solo
Radiohead|Just|19|chaotic muff fuzz
Smashing Pumpkins|Today|19|Big Muff wall
Smashing Pumpkins|1979|3|clean chorus jangle
Smashing Pumpkins|Bullet with Butterfly Wings|20|heavy Marshall fuzz
Queens of the Stone Age|Go with the Flow|24|pulsing desert riff
Queens of the Stone Age|Little Sister|13|dry garage crunch
The White Stripes|Seven Nation Army|25|heavy octave fuzz
The White Stripes|Fell in Love with a Girl|49|raw garage fuzz
The White Stripes|Icky Thump|25|stoner fuzz riff
Muse|Hysteria|25|heavy low fuzz
Muse|Supermassive Black Hole|49|funky fuzz wah
Green Day|Basket Case|17|crunch power chords
Green Day|American Idiot|17|Marshall punk rhythm
Green Day|Boulevard of Broken Dreams|13|clean mid crunch
Weezer|Buddy Holly|17|Marshall pop crunch
Weezer|Say It Ain't So|8|clean to crunch
The Strokes|Last Nite|13|dry garage crunch
The Strokes|Reptilia|17|stabbing Marshall riff
Jane's Addiction|Mountain Song|20|heavy Marshall riff
Jane's Addiction|Been Caught Stealing|3|quirky funky clean
Pixies|Where Is My Mind|8|soft clean arpeggio
Pixies|Debaser|13|garage punk crunch
Sonic Youth|Teen Age Riot|19|muff noise fuzz
Tool|Schism|11|clean bass-arpeggio
Tool|Sober|20|dark heavy riff
System of a Down|Chop Suey!|21|staccato thrash drop
System of a Down|Toxicity|21|heavy drop riff
Deftones|My Own Summer|20|heavy atmospheric drop
Deftones|Change|36|ethereal dense Bogner
Incubus|Drive|8|warm clean acoustic
Incubus|Pardon Me|13|dynamic funky crunch
Mudhoney|Touch Me I'm Sick|49|dirty garage fuzz
Screaming Trees|Nearly Lost You|17|Marshall grunge crunch
Nine Inch Nails|The Hand That Feeds|20|industrial distortion riff
The Killers|Mr. Brightside|3|post-punk clean jangle
Interpol|Evil|3|bright post-punk clean

# --- prog / instrumental ---
Pink Floyd|Shine On You Crazy Diamond|27|Gilmour sustained Muff
David Gilmour|Marooned|27|fuzz sustain with bends
Pink Floyd|Time|27|Big Muff solo
Gary Moore|The Loner|41|cranked rock solo
Steve Hackett|Firth of Fifth|28|smooth prolonged sustain
King Crimson|Starless|26|melodic clean lead
Jeff Beck|Where Were You|26|melodic clean swells
Mark Knopfler|Telegraph Road|4|fingered clean Strat
Eric Johnson|Manhattan|4|bright clean chords
Steve Howe|Mood for a Day|4|clean fingered acoustic
Al Di Meola|Mediterranean Sundance|4|fast clean nylon
Polyphia|Playing God|4|modern clean fingerstyle
U2|With or Without You|2|clean chime with delay
Radiohead|Weird Fishes|2|clean arpeggios with delay
Sigur Ros|Saeglopur|10|reverberant clean ambience
Explosions in the Sky|Your Hand in Mine|10|clean ambient crescendo
Plini|Handmade Cities|10|atmospheric clean ambience
Scale the Summit|The Great Plains|10|ambient clean instrumental
Porcupine Tree|Trains|11|warm clean acoustic
Opeth|Windowpane|11|soft melancholic clean
George Harrison|My Sweet Lord|30|sweet melodic slide
Derek Trucks|Anyday|30|singing sustain slide
Joe Satriani|Surfing with the Alien|31|fluid legato lead
Guthrie Govan|Fives|31|fluid fusion legato
Steve Vai|Tender Surrender|47|expressive emotive legato
Plini|Electric Sunrise|47|soaring legato lead
Guthrie Govan|Waves|47|fluid modern legato
Jason Becker|Altitudes|47|soaring melodic legato
Rush|La Villa Strangiato|32|melodic prog Marshall solo
Yes|Roundabout|32|melodic prog Marshall lead
Steven Wilson|Routine|32|melodic Marshall solo
Rush|Limelight|44|boosted Marshall lead
Buckethead|Soothsayer|44|powerful emotive Marshall lead
Yngwie Malmsteen|Black Star|43|smooth neoclassical Soldano
Jason Becker|Serrana|43|virtuoso neoclassical
Joe Satriani|Crushing Day|46|fast picking shred
Paul Gilbert|Technical Difficulties|46|fast shred picking
Racer X|Scarified|46|fast technical shred
Steve Morse|Tumeni Notes|46|fast precise picking
Steve Vai|Building the Church|46|modern Soldano shred
Polyphia|G.O.A.T.|46|modern technical shred
Al Di Meola|Race with Devil on Spanish Highway|46|electric fusion shred
Dream Theater|The Dance of Eternity|46|technical Soldano shred
John Petrucci|Glasgow Kiss|46|Soldano legato shred
Metallica|One (solo)|45|Mesa wah shred
Tool|Lateralus|45|heavy Mesa riff
Animals as Leaders|CAFO|45|heavy Mesa djent
Gojira|Flying Whales|45|modern heavy Mesa
Periphery|Scarlet|45|aggressive heavy djent
Opeth|Blackwater Park|45|heavy Mesa riff
Tom Morello|Killing in the Name (solo)|50|aggressive whammy effects

# --- pop-rock / new wave / indie / funk ---
U2|Pride (In the Name of Love)|2|bright clean with delay
Coldplay|Yellow|2|ambient clean AC30
Simple Minds|Don't You Forget About Me|2|new-wave chime
The Smiths|This Charming Man|3|Marr clean jangle
The Cure|A Forest|3|dark chorus/flanger
Talking Heads|Once in a Lifetime|3|clean chorus funk-new-wave
R.E.M.|Losing My Religion|3|jangly Rickenbacker
Echo & the Bunnymen|The Killing Moon|3|atmospheric jangle
Fleetwood Mac|Dreams|1|smooth clean Strat
Tom Petty|Free Fallin'|4|warm clean arpeggios
America|A Horse With No Name|4|clean folk-rock
Dick Dale|Misirlou|7|surf tremolo twang
The Ventures|Walk Don't Run|7|clean surf twang
The Shadows|Apache|7|twang with tremolo
Duane Eddy|Rebel Rouser|7|low twang with reverb
Link Wray|Rumble|7|dirty tremolo twang
The Tornados|Telstar|7|clean twang with reverb
Chic|Le Freak|8|Nile clean funk
Chic|Good Times|8|clean Strat funk
Michael Jackson|Rock With You|8|smooth clean funk
Prince|Kiss|8|staccato clean funk
Daft Punk|Get Lucky|8|Nile clean funk
Jamiroquai|Canned Heat|8|disco clean funk
Average White Band|Pick Up the Pieces|8|clean funk with groove
Sister Sledge|We Are Family|8|Nile clean funk
Toto|Africa|9|AOR clean arpeggios
Steely Dan|Peg|9|clean jazz-AOR
The Killers|Mr. Brightside|12|bright repetitive chime
The Cars|Just What I Needed|12|new-wave chime
The Rolling Stones|Start Me Up|13|open-G crunch
The Kinks|All Day and All of the Night|13|power-chord crunch
Deep Purple|Smoke on the Water (riff)|16|iconic Plexi riff
Thin Lizzy|Whiskey in the Jar|16|melodic Plexi rock
Bon Jovi|Livin' on a Prayer|17|arena JCM800 rock
Whitesnake|Here I Go Again|17|melodic JCM800
Jimi Hendrix|The Wind Cries Mary|29|clean Strat with arpeggios
Prince|Purple Rain|48|sustained Les Paul solo
Queen|Don't Stop Me Now|40|boosted AC30 solo
Guns N' Roses|November Rain|48|Les Paul Marshall solo
Michael Jackson|Beat It|38|EVH Plexi tapping solo
`;

  function load_m50(folderMap) {
    const d = folderMap["Compilation_Best50.json"];
    const info = {};
    for (const p of d.presets) {
      const m = p.modules;
      const a = ((m.AMP || m.Clone || {}).effect) || "";
      const drv = m.DRV.enabled ? m.DRV.effect
        : (m.FX1.enabled && m.FX1.effect === "Boost" ? "booster" : "-");
      const k = p.kind || "";
      const role = { C: "clean", R: "rhythm", H: "heavy" }[k] || "solo";
      info[p.slot] = { name: p.presetName, artist: p.artist || "",
        song: p.description.split(":")[0], amp: a, drv, role };
    }
    return info;
  }
  function parse() {
    const rows = [], seen = new Set();
    for (let ln of DATA.split("\n")) {
      ln = ln.trim();
      if (!ln || ln.startsWith("#")) continue;
      const parts = ln.split("|").map((x) => x.trim());
      let slot = null;
      for (const x of parts) if (/^\d+$/.test(x)) { slot = parseInt(x, 10); break; }
      if (slot === null || parts.length < 3) continue;
      const artist = parts[0], song = parts[1];
      const reason = !/^\d+$/.test(parts[parts.length - 1]) ? parts[parts.length - 1] : "";
      const key = artist.toLowerCase() + " " + song.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ artist, song, slot, reason });
    }
    return rows;
  }
  function bySlot(rows) {
    const by = {};
    for (const r of rows) (by[r.slot] || (by[r.slot] = [])).push(r);
    for (const s of Object.keys(by))
      by[s].sort((a, b) => {
        const ax = a.artist.toLowerCase(), bx = b.artist.toLowerCase();
        if (ax !== bx) return ax < bx ? -1 : 1;
        const at = a.song.toLowerCase(), bt = b.song.toLowerCase();
        return at < bt ? -1 : at > bt ? 1 : 0;
      });
    return by;
  }

  function buildMap(folderMap) {
    const m50 = load_m50(folderMap);
    const rows = parse();
    const by_slot = bySlot(rows);
    const cards = [];
    for (let slot = 1; slot <= 50; slot++) {
      const i = m50[slot];
      if (!i) continue;
      const songs = by_slot[slot] || [];
      const rowshtml = songs.map((r) =>
        `<div class="s" data-f="${esc((r.artist + " " + r.song).toLowerCase())}">` +
        `<span class="a">${esc(r.artist)}</span>` +
        `<span class="t">${esc(r.song)}</span>` +
        `<span class="w">${esc(r.reason)}</span></div>`).join("");
      cards.push(
        `<details class="slot" open data-f="${esc((i.artist + " " + i.song + " " + i.amp).toLowerCase())}">` +
        `<summary><span class="sl">p${slot}</span>` +
        `<span class="pn">${esc(i.name)}</span>` +
        `<span class="pref">${esc(i.artist)} &middot; ${esc(i.song)}</span>` +
        `<span class="amp">${esc(i.amp)}${(i.drv !== "-" && i.drv !== "") ? " + " + esc(i.drv) : ""}` +
        ` &middot; ${esc(i.role)}</span>` +
        `<span class="cnt">${songs.length}</span></summary>` +
        `<div class="songs">${rowshtml || "<i>(no matches)</i>"}</div></details>`);
    }
    const CSS = MAP_CSS;
    const JS = MAP_JS;
    const total = rows.length;
    const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Song map &rarr; Best 50</title><style>${CSS}</style></head><body>` +
      `<header><h1>Song map &rarr; Best 50</h1>` +
      `<div class="sub">${total} songs mapped to their closest M50 preset. ` +
      `Search by song, artist or amp. Grouped by preset: see everything each one covers.</div>` +
      `<input id="q" placeholder="Search song, artist or amp..." autocomplete="off"></header>` +
      `<div class="wrap">${cards.join("")}</div><script>${JS}</script></body></html>`;
    return doc;
  }

  function buildMapPrint(folderMap) {
    const m50 = load_m50(folderMap);
    const rows = parse();
    const by_slot = bySlot(rows);
    const blocks = [];
    for (let slot = 1; slot <= 50; slot++) {
      const i = m50[slot];
      if (!i) continue;
      const songs = by_slot[slot] || [];
      const lis = songs.map((r) => `<li><b>${esc(r.artist)}</b> &ndash; ${esc(r.song)}</li>`).join("");
      const amp = esc(i.amp) + ((i.drv !== "-" && i.drv !== "") ? "+" + esc(i.drv) : "");
      blocks.push(
        `<div class="blk"><div class="bh"><span class="p">p${slot}</span> ` +
        `<b>${esc(i.name)}</b> <span class="ref">${esc(i.artist)}/${esc(i.song)}</span> ` +
        `<span class="amp">${amp} &middot; ${esc(i.role)}</span> ` +
        `<span class="n">(${songs.length})</span></div>` +
        `<ul>${lis || "<li><i>&mdash;</i></li>"}</ul></div>`);
    }
    const CSS = MAP_PRINT_CSS;
    const total = rows.length;
    const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<title>Best 50 map (printable)</title><style>${CSS}</style></head><body>` +
      `<h1>Song map &rarr; Best 50</h1>` +
      `<div class="sub">${total} songs to their closest M50 preset, grouped by preset. ` +
      `Amps: Voks=Vox AC30, Brit 45=JTM45, Brit 50JP=Plexi, Brit 800=JCM800, Dark Twin=Fender, ` +
      `TWD=Tweed, Sol 100 LD=Soldano, B-Man=Bassman, Calif DualM=Mesa, A BassVT=Ampeg.</div>` +
      `<div class="cols">${blocks.join("")}</div></body></html>`;
    return doc;
  }

  function buildM50(folderMap) {
    return { "map_Best50.html": buildMap(folderMap), "map_Best50_print.html": buildMapPrint(folderMap) };
  }

  const MAP_CSS = String.raw`
    :root{--bg:#0f1115;--card:#1a1d24;--fg:#e7e9ee;--mut:#9aa2b1;--acc:#7bb0ff;--line:#2a2e38}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);
    font:15px/1.4 system-ui,Segoe UI,Roboto,sans-serif}
    header{position:sticky;top:0;background:#0f1115ee;backdrop-filter:blur(6px);
    padding:14px 16px;border-bottom:1px solid var(--line);z-index:5}
    h1{margin:0 0 8px;font-size:18px}.sub{color:var(--mut);font-size:13px;margin-bottom:8px}
    #q{width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--line);
    background:#12151b;color:var(--fg);font-size:15px}
    .wrap{max-width:1000px;margin:0 auto;padding:12px 16px}
    .slot{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:10px 0;overflow:hidden}
    summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:10px 12px;flex-wrap:wrap}
    summary::-webkit-details-marker{display:none}
    .sl{font-weight:700;color:#0f1115;background:var(--acc);border-radius:6px;padding:1px 7px;font-size:13px}
    .pn{font-weight:700}.pref{color:var(--mut);font-size:13px}
    .amp{color:var(--acc);font-size:12px}.cnt{margin-left:auto;color:var(--mut);font-size:12px;
    border:1px solid var(--line);border-radius:20px;padding:1px 9px}
    .songs{border-top:1px solid var(--line);padding:4px 0}
    .s{display:flex;gap:10px;padding:5px 14px;border-bottom:1px solid #21252e}
    .s:last-child{border-bottom:none}.s .a{width:32%;color:var(--fg)}
    .s .t{width:36%;color:var(--mut)}.s .w{flex:1;color:#6f7788;font-size:12px;font-style:italic}
    .hide{display:none}
    @media(max-width:640px){.s{flex-direction:column;gap:1px}.s .a,.s .t{width:auto}.pref{display:none}}
    @media(max-height:520px){header{position:static;padding:6px 16px}h1,.sub{display:none}}
    `;
  const MAP_JS = String.raw`
    const q=document.getElementById('q');
    q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();
    document.querySelectorAll('.slot').forEach(sl=>{let any=false;
    sl.querySelectorAll('.s').forEach(s=>{const m=!v||s.dataset.f.includes(v)||sl.dataset.f.includes(v);
    s.classList.toggle('hide',!m);if(m)any=true;});
    sl.classList.toggle('hide',!any&&v!=='');if(v)sl.open=true;});});
    `;
  const MAP_PRINT_CSS = String.raw`
    @page{size:A4;margin:10mm}
    *{box-sizing:border-box}body{margin:0;color:#000;background:#fff;
    font:9px/1.25 Arial,Helvetica,sans-serif}
    h1{font-size:15px;margin:0 0 2px}.sub{font-size:9px;color:#444;margin-bottom:6px}
    .cols{column-count:3;column-gap:6mm}
    @media(max-width:800px){.cols{column-count:2}}
    .blk{break-inside:avoid;margin:0 0 4px;border:1px solid #bbb;border-radius:4px;padding:3px 5px}
    .bh{font-size:9px;border-bottom:1px solid #ddd;padding-bottom:2px;margin-bottom:2px;line-height:1.3}
    .p{background:#222;color:#fff;border-radius:3px;padding:0 4px;font-weight:700}
    .ref{color:#555}.amp{color:#0a58ca}.n{color:#888}
    ul{margin:0;padding:0 0 0 2px;list-style:none}
    li{padding:1px 0;border-bottom:1px dotted #eee}li b{font-weight:700}
    `;

  return { buildM50 };
});
