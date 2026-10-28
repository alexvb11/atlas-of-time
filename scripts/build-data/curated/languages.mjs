// Language catalogue. `family` is a path from the root family to the language (for the family tree).
// `hello`: a greeting only where one is recorded. `attested`: a known word when no greeting is
// recorded. `voice`: BCP-47 tag for the Web Speech API when a voice is likely to exist.
// `reconstructed: true` marks pronunciation as scholarly reconstruction.
export const languages = [
  // Indo-European > Armenian
  { id: 'armenian', name: 'Armenian', native: 'Հայերեն', family: ['Indo-European', 'Armenian', 'Armenian'], hello: { text: 'Բարև', roman: 'barev' }, voice: 'hy-AM' },
  { id: 'old-armenian', name: 'Classical Armenian (Grabar)', native: 'Գրաբար', family: ['Indo-European', 'Armenian', 'Classical Armenian'], attested: { text: 'ողջոյն', roman: 'ołǰoyn', meaning: '"health", the greeting used in letters' }, reconstructed: true },
  { id: 'middle-armenian', name: 'Middle Armenian', native: 'Միջին հայերեն', family: ['Indo-European', 'Armenian', 'Middle Armenian'], attested: { text: 'ողջոյն', roman: 'ołǰoyn', meaning: 'greeting' }, reconstructed: true },
  // Hurro-Urartian
  { id: 'urartian', name: 'Urartian', native: '—', family: ['Hurro-Urartian', 'Urartian'], attested: { text: 'euri', roman: 'euri', meaning: '"lord", from royal inscriptions in cuneiform' }, reconstructed: true },
  { id: 'hurrian', name: 'Hurrian', native: '—', family: ['Hurro-Urartian', 'Hurrian'], attested: { text: 'šarri', roman: 'šarri', meaning: '"king"' }, reconstructed: true },
  // Kartvelian
  { id: 'georgian', name: 'Georgian', native: 'ქართული', family: ['Kartvelian', 'Georgian'], hello: { text: 'გამარჯობა', roman: 'gamarjoba' }, voice: 'ka-GE' },
  { id: 'old-georgian', name: 'Old Georgian', native: 'ძველი ქართული', family: ['Kartvelian', 'Old Georgian'], note: 'Written from the 5th century CE; no everyday greeting recorded.', reconstructed: true },
  // Turkic
  { id: 'azerbaijani', name: 'Azerbaijani', native: 'Azərbaycan dili', family: ['Turkic', 'Oghuz', 'Azerbaijani'], hello: { text: 'Salam', roman: 'salam' }, voice: 'az-AZ' },
  { id: 'turkish', name: 'Turkish', native: 'Türkçe', family: ['Turkic', 'Oghuz', 'Turkish'], hello: { text: 'Merhaba', roman: 'merhaba' }, voice: 'tr-TR' },
  { id: 'ottoman-turkish', name: 'Ottoman Turkish', native: 'لسان عثمانى', family: ['Turkic', 'Oghuz', 'Ottoman Turkish'], hello: { text: 'مرحبا', roman: 'merhaba' } },
  { id: 'mongolian', name: 'Mongolian', native: 'Монгол хэл', family: ['Mongolic', 'Mongolian'], hello: { text: 'Сайн байна уу', roman: 'sain baina uu' }, voice: 'mn-MN' },
  // Iranian
  { id: 'persian', name: 'Persian', native: 'فارسی', family: ['Indo-European', 'Indo-Iranian', 'Iranian', 'Persian'], hello: { text: 'سلام', roman: 'salâm' }, voice: 'fa-IR' },
  { id: 'old-persian', name: 'Old Persian', native: '𐎱𐎠𐎼𐎿', family: ['Indo-European', 'Indo-Iranian', 'Iranian', 'Old Persian'], attested: { text: '𐏋', roman: 'xšāyaθiya', meaning: '"king", from the Behistun inscription' }, reconstructed: true },
  { id: 'parthian', name: 'Parthian', native: '—', family: ['Indo-European', 'Indo-Iranian', 'Iranian', 'Parthian'], note: 'Known from inscriptions and Manichaean texts; no greeting recorded.', reconstructed: true },
  { id: 'middle-persian', name: 'Middle Persian (Pahlavi)', native: '—', family: ['Indo-European', 'Indo-Iranian', 'Iranian', 'Middle Persian'], attested: { text: 'drōd', roman: 'drōd', meaning: '"health, greeting" (modern Persian dorud)' }, reconstructed: true },
  { id: 'kurdish', name: 'Kurdish (Kurmanji)', native: 'Kurmancî', family: ['Indo-European', 'Indo-Iranian', 'Iranian', 'Kurdish'], hello: { text: 'Silav', roman: 'silav' } },
  // Semitic
  { id: 'aramaic', name: 'Aramaic', native: 'ܐܪܡܝܐ', family: ['Afro-Asiatic', 'Semitic', 'Aramaic'], attested: { text: 'ܫܠܡܐ', roman: 'šlāmā', meaning: '"peace", the usual greeting' }, reconstructed: true },
  { id: 'arabic', name: 'Arabic', native: 'العربية', family: ['Afro-Asiatic', 'Semitic', 'Arabic'], hello: { text: 'مرحبا', roman: 'marḥaban' }, voice: 'ar-SA' },
  { id: 'akkadian', name: 'Akkadian', native: '𒀝𒅗𒁺𒌑', family: ['Afro-Asiatic', 'Semitic', 'Akkadian'], attested: { text: 'šulmu', roman: 'šulmu', meaning: '"well-being", used in letter greetings' }, reconstructed: true },
  { id: 'phoenician', name: 'Phoenician / Punic', native: '𐤃𐤁𐤓𐤉𐤌 𐤊𐤍𐤏𐤍𐤉𐤌', family: ['Afro-Asiatic', 'Semitic', 'Phoenician'], note: 'Known from inscriptions; no greeting recorded.', reconstructed: true },
  // Egyptian
  { id: 'egyptian', name: 'Ancient Egyptian', native: 'r n kmt', family: ['Afro-Asiatic', 'Egyptian', 'Ancient Egyptian'], attested: { text: 'ỉnḏ ḥr.k', roman: 'inedj her-ek', meaning: '"hail to you"' }, reconstructed: true },
  { id: 'coptic', name: 'Coptic', native: 'ⲙⲉⲧⲣⲉⲙⲛ̀ⲭⲏⲙⲓ', family: ['Afro-Asiatic', 'Egyptian', 'Coptic'], attested: { text: 'ⲭⲉⲣⲉ', roman: 'khere', meaning: 'greeting borrowed from Greek χαῖρε' } },
  // Hellenic
  { id: 'mycenaean-greek', name: 'Mycenaean Greek', native: '—', family: ['Indo-European', 'Hellenic', 'Mycenaean Greek'], note: 'Written in Linear B on administrative tablets; no greeting recorded.', reconstructed: true },
  { id: 'ancient-greek', name: 'Ancient Greek', native: 'Ἑλληνική', family: ['Indo-European', 'Hellenic', 'Ancient Greek'], hello: { text: 'χαῖρε', roman: 'khaîre' }, reconstructed: true },
  { id: 'koine-greek', name: 'Koine Greek', native: 'Κοινή', family: ['Indo-European', 'Hellenic', 'Koine Greek'], hello: { text: 'χαῖρε', roman: 'chaire' }, reconstructed: true },
  { id: 'medieval-greek', name: 'Medieval Greek', native: 'Ῥωμαϊκή', family: ['Indo-European', 'Hellenic', 'Medieval Greek'], hello: { text: 'χαῖρε', roman: 'chére' }, reconstructed: true },
  { id: 'greek', name: 'Greek', native: 'Ελληνικά', family: ['Indo-European', 'Hellenic', 'Greek'], hello: { text: 'Γεια σας', roman: 'yia sas' }, voice: 'el-GR' },
  // Italic
  { id: 'etruscan', name: 'Etruscan', native: 'Rasna', family: ['Tyrsenian', 'Etruscan'], attested: { text: 'avil', roman: 'avil', meaning: '"year", common on epitaphs' }, reconstructed: true },
  { id: 'latin', name: 'Latin', native: 'Lingua Latina', family: ['Indo-European', 'Italic', 'Latin'], hello: { text: 'Salvē', roman: 'salvē' }, reconstructed: true },
  { id: 'italian', name: 'Italian', native: 'Italiano', family: ['Indo-European', 'Italic', 'Latin', 'Romance', 'Italian'], hello: { text: 'Ciao', roman: 'ciao' }, voice: 'it-IT' },
  { id: 'spanish', name: 'Spanish', native: 'Español', family: ['Indo-European', 'Italic', 'Latin', 'Romance', 'Spanish'], hello: { text: 'Hola', roman: 'hola' }, voice: 'es-MX' },
  { id: 'french', name: 'French', native: 'Français', family: ['Indo-European', 'Italic', 'Latin', 'Romance', 'French'], hello: { text: 'Bonjour', roman: 'bonjour' }, voice: 'fr-FR' },
  { id: 'norman-french', name: 'Anglo-Norman French', native: 'Anglo-Normaunt', family: ['Indo-European', 'Italic', 'Latin', 'Romance', 'Anglo-Norman'], attested: { text: 'salut', roman: 'salut', meaning: 'greeting' }, reconstructed: true },
  // Germanic
  { id: 'old-english', name: 'Old English', native: 'Englisc', family: ['Indo-European', 'Germanic', 'West Germanic', 'Old English'], hello: { text: 'Wes hāl', roman: 'wes hāl', note: '"be healthy", origin of "wassail"' }, reconstructed: true },
  { id: 'middle-english', name: 'Middle English', native: 'Englisch', family: ['Indo-European', 'Germanic', 'West Germanic', 'Middle English'], hello: { text: 'Hail', roman: 'hail' }, reconstructed: true },
  { id: 'english', name: 'English', native: 'English', family: ['Indo-European', 'Germanic', 'West Germanic', 'English'], hello: { text: 'Hello', roman: 'hello' }, voice: 'en-GB' },
  { id: 'scots', name: 'Scots', native: 'Scots', family: ['Indo-European', 'Germanic', 'West Germanic', 'Scots'], hello: { text: 'Hullo', roman: 'hullo' } },
  { id: 'old-norse', name: 'Old Norse', native: 'Dǫnsk tunga', family: ['Indo-European', 'Germanic', 'North Germanic', 'Old Norse'], hello: { text: 'Heill', roman: 'heill' }, reconstructed: true },
  { id: 'russian', name: 'Russian', native: 'Русский', family: ['Indo-European', 'Balto-Slavic', 'Slavic', 'Russian'], hello: { text: 'Здравствуйте', roman: 'zdravstvuyte' }, voice: 'ru-RU' },
  // Celtic
  { id: 'brittonic', name: 'Common Brittonic', native: '—', family: ['Indo-European', 'Celtic', 'Brittonic'], note: 'Known from names on coins and Roman records; no greeting recorded.', reconstructed: true },
  { id: 'welsh', name: 'Welsh', native: 'Cymraeg', family: ['Indo-European', 'Celtic', 'Brittonic', 'Welsh'], hello: { text: 'Shwmae', roman: 'shw-my' }, voice: 'cy-GB' },
  { id: 'old-irish', name: 'Old Irish', native: 'Goídelc', family: ['Indo-European', 'Celtic', 'Goidelic', 'Old Irish'], note: 'Written from the 6th century; no everyday greeting recorded.', reconstructed: true },
  { id: 'irish', name: 'Irish', native: 'Gaeilge', family: ['Indo-European', 'Celtic', 'Goidelic', 'Irish'], hello: { text: 'Dia duit', roman: 'dee-a gwit' }, voice: 'ga-IE' },
  { id: 'gaelic', name: 'Scottish Gaelic', native: 'Gàidhlig', family: ['Indo-European', 'Celtic', 'Goidelic', 'Scottish Gaelic'], hello: { text: 'Halò', roman: 'ha-lo' } },
  { id: 'pictish', name: 'Pictish', native: '—', family: ['Indo-European', 'Celtic', 'Pictish'], note: 'Barely attested, mainly in place names; its classification is debated.', reconstructed: true },
  // Sinitic
  { id: 'old-chinese', name: 'Old Chinese', native: '上古漢語', family: ['Sino-Tibetan', 'Sinitic', 'Old Chinese'], note: 'Written on oracle bones and bronzes; pronunciation is reconstructed.', reconstructed: true },
  { id: 'middle-chinese', name: 'Middle Chinese', native: '中古漢語', family: ['Sino-Tibetan', 'Sinitic', 'Middle Chinese'], note: 'Pronunciation reconstructed from rhyme dictionaries such as the Qieyun (601 CE).', reconstructed: true },
  { id: 'mandarin', name: 'Mandarin Chinese', native: '普通话', family: ['Sino-Tibetan', 'Sinitic', 'Mandarin'], hello: { text: '你好', roman: 'nǐ hǎo' }, voice: 'zh-CN' },
  { id: 'cantonese', name: 'Cantonese', native: '粵語', family: ['Sino-Tibetan', 'Sinitic', 'Yue'], hello: { text: '你好', roman: 'néih hóu' }, voice: 'zh-HK' },
  { id: 'wu', name: 'Wu Chinese', native: '吴语', family: ['Sino-Tibetan', 'Sinitic', 'Wu'], hello: { text: '侬好', roman: 'non ho' } },
  { id: 'manchu', name: 'Manchu', native: 'ᠮᠠᠨᠵᡠ ᡤᡳᠰᡠᠨ', family: ['Tungusic', 'Manchu'], note: 'Co-official in the Qing court; now nearly extinct as a spoken language.' },
  // Mesoamerica
  { id: 'mixe-zoque', name: 'Mixe–Zoquean (proto)', native: '—', family: ['Mixe–Zoque'], note: 'Proposed language of the Olmec; this attribution is a hypothesis.', reconstructed: true },
  { id: 'classic-maya', name: 'Classic Maya', native: '—', family: ['Mayan', 'Classic Maya'], attested: { text: 'ajaw', roman: 'ajaw', meaning: '"lord, ruler", from hieroglyphic inscriptions' }, reconstructed: true },
  { id: 'yucatec', name: 'Yucatec Maya', native: "Maaya t'aan", family: ['Mayan', 'Yucatecan', 'Yucatec Maya'], hello: { text: "Ba'ax ka wa'alik?", roman: 'baash ka wa-lik', note: '"what do you say?", a common greeting' } },
  { id: 'nahuatl', name: 'Nahuatl', native: 'Nāhuatlahtōlli', family: ['Uto-Aztecan', 'Nahuan', 'Nahuatl'], hello: { text: 'Niltze', roman: 'neel-tseh', note: 'regional; greetings vary by dialect' } },
  { id: 'otomi', name: 'Otomi', native: 'Hñähñu', family: ['Oto-Manguean', 'Otomi'], note: 'Greetings vary widely between Otomi varieties.' },
  { id: 'zapotec', name: 'Zapotec', native: 'Diidxazá', family: ['Oto-Manguean', 'Zapotecan'], note: 'A family of languages; greetings vary by variety.' },
]
