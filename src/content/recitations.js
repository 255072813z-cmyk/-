// 礼拜念词：阿拉伯文原文 + 译音（拉丁字母）+ 中文意思 + 出处
//
// 核对说明（2026-11）：
// - 古兰经经文：Tanzil 标准文本，中文为马坚译本（见 quran.js，脚本生成）
// - 圣训念词：按出处原文逐字核对（经 fawazahmed0/hadith-api 的阿拉伯文本）
//   · 赞主词：艾布·达乌德 776，提尔密济 243
//   · 鞠躬、叩头赞词各三遍：穆斯林 772，提尔密济 261
//   · 起身念词：布哈里 789、796
//   · 作证词（伊本·麦斯欧德传述，哈乃斐学派采用）：布哈里 831
//   · 赞圣词：布哈里 3370
//   · 出拜后念词：穆斯林 591
//   · 赞念 33 遍及第 100 遍：穆斯林 595、597
//   · 小净后的作证与祈祷：穆斯林 234，提尔密济 55
//   · 开斋时念：艾布·达乌德 2357（多位学者评为良好）
// - 古努特（威特尔拜）：哈乃斐学派通行的念法，以"مُلْحِقٌ"结尾，不加"كله"
//   （见《al-Bahr al-Ra'iq》；Askimam 教法答复 102830 引 al-Birjandi）
// 译音为方便跟读的简化拼法（拉丁字母）；以后给塔吉克语、俄语用户加西里尔字母译音 trCyrl。
// 每条的意思和出处按语言分字段：{ zh, tg, ru }，界面用 L() 取当前语言。
import { SURAHS, RABBANA_201 } from './quran.js';

export const R = {
  takbir: {
    ar: 'اللَّهُ أَكْبَرُ',
    tr: 'Allahu akbar',
    zh: '真主至大',
    src: { zh: '大赞词' },
  },
  thana: {
    ar: 'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ، وَتَبَارَكَ اسْمُكَ، وَتَعَالَى جَدُّكَ، وَلَا إِلَهَ غَيْرُكَ',
    tr: "Subhanakallahumma wa bihamdika, wa tabarakasmuka, wa ta'ala jadduka, wa la ilaha ghayruk",
    zh: '主啊，赞你清净，赞颂归于你；你的尊名吉祥，你的威严崇高，除你之外再无应受崇拜的。',
    src: { zh: '艾布·达乌德 776；提尔密济 243' },
  },
  taawwudh: {
    ar: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
    tr: "A'udhu billahi minash-shaytanir-rajim",
    zh: '我求真主护佑，免遭被驱逐的恶魔的伤害。',
    src: { zh: '依《古兰经》16:98' },
  },
  basmala: {
    ar: SURAHS[1].ayahs[0].ar,
    tr: 'Bismillahir-rahmanir-rahim',
    zh: SURAHS[1].ayahs[0].zh,
    src: { zh: '《古兰经》1:1，马坚译' },
  },
  amin: {
    ar: 'آمِين',
    tr: 'Amin',
    zh: '主啊，求你应答。',
    src: { zh: '布哈里 780' },
  },
  ruku: {
    ar: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
    tr: "Subhana rabbiyal-'azim",
    zh: '赞我伟大的主清净。',
    src: { zh: '穆斯林 772；提尔密济 261' },
  },
  tasmi: {
    ar: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ',
    tr: "Sami'allahu liman hamidah",
    zh: '真主听见了赞颂他的人。',
    src: { zh: '布哈里 789' },
  },
  tahmid: {
    ar: 'رَبَّنَا لَكَ الْحَمْدُ',
    tr: 'Rabbana lakal-hamd',
    zh: '我们的主啊，一切赞颂都归于你。',
    src: { zh: '布哈里 789、796' },
  },
  sujud: {
    ar: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
    tr: "Subhana rabbiyal-a'la",
    zh: '赞我至高的主清净。',
    src: { zh: '穆斯林 772；提尔密济 261' },
  },
  tashahhud: {
    ar:
      'التَّحِيَّاتُ لِلَّهِ وَالصَّلَوَاتُ وَالطَّيِّبَاتُ، السَّلَامُ عَلَيْكَ أَيُّهَا النَّبِيُّ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، ' +
      'السَّلَامُ عَلَيْنَا وَعَلَى عِبَادِ اللَّهِ الصَّالِحِينَ، أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
    tr:
      "At-tahiyyatu lillahi was-salawatu wat-tayyibat. As-salamu 'alayka ayyuhan-nabiyyu wa rahmatullahi wa barakatuh. " +
      "As-salamu 'alayna wa 'ala 'ibadillahis-salihin. Ash-hadu an la ilaha illallah, wa ash-hadu anna Muhammadan 'abduhu wa rasuluh",
    zh:
      '一切祝福、礼拜和美好的言行都归于真主。先知啊，愿你平安，并蒙真主的慈悯和福泽。' +
      '愿我们和真主所有清廉的仆人都得平安。我作证：除真主外，再无应受崇拜的；我作证：穆罕默德是他的仆人和使者。',
    src: { zh: '布哈里 831（伊本·麦斯欧德传述）' },
  },
  salawat: {
    ar:
      'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ، ' +
      'اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ، كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ، إِنَّكَ حَمِيدٌ مَجِيدٌ',
    tr:
      "Allahumma salli 'ala Muhammadin wa 'ala ali Muhammad, kama sallayta 'ala Ibrahima wa 'ala ali Ibrahim, innaka hamidun majid. " +
      "Allahumma barik 'ala Muhammadin wa 'ala ali Muhammad, kama barakta 'ala Ibrahima wa 'ala ali Ibrahim, innaka hamidun majid",
    zh:
      '主啊，求你赐福穆罕默德和穆罕默德的家属，犹如你赐福易卜拉欣和易卜拉欣的家属，你确是受赞颂的、光荣的。' +
      '主啊，求你降吉庆于穆罕默德和穆罕默德的家属，犹如你降吉庆于易卜拉欣和易卜拉欣的家属，你确是受赞颂的、光荣的。',
    src: { zh: '布哈里 3370' },
  },
  rabbana: {
    ar: RABBANA_201.ar,
    tr: "Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina 'adhaban-nar",
    zh: RABBANA_201.zh,
    src: { zh: '《古兰经》2:201，马坚译' },
  },
  salam: {
    ar: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
    tr: "As-salamu 'alaykum wa rahmatullah",
    zh: '愿你们平安，并蒙真主的慈悯。',
    src: { zh: '出拜词' },
  },
  qunut: {
    ar:
      'اللَّهُمَّ إِنَّا نَسْتَعِينُكَ وَنَسْتَغْفِرُكَ، وَنُؤْمِنُ بِكَ وَنَتَوَكَّلُ عَلَيْكَ، وَنُثْنِي عَلَيْكَ الْخَيْرَ، ' +
      'وَنَشْكُرُكَ وَلَا نَكْفُرُكَ، وَنَخْلَعُ وَنَتْرُكُ مَنْ يَفْجُرُكَ، اللَّهُمَّ إِيَّاكَ نَعْبُدُ، وَلَكَ نُصَلِّي وَنَسْجُدُ، ' +
      'وَإِلَيْكَ نَسْعَى وَنَحْفِدُ، وَنَرْجُو رَحْمَتَكَ وَنَخْشَى عَذَابَكَ، إِنَّ عَذَابَكَ بِالْكُفَّارِ مُلْحِقٌ',
    tr:
      "Allahumma inna nasta'inuka wa nastaghfiruk, wa nu'minu bika wa natawakkalu 'alayk, wa nuthni 'alaykal-khayr, " +
      "wa nashkuruka wa la nakfuruk, wa nakhla'u wa natruku man yafjuruk. Allahumma iyyaka na'bud, wa laka nusalli wa nasjud, " +
      "wa ilayka nas'a wa nahfid, wa narju rahmataka wa nakhsha 'adhabak, inna 'adhabaka bil-kuffari mulhiq",
    zh:
      '主啊，我们向你求助，向你求饶；我们信仰你，依靠你，以美好的言辞赞颂你；我们感谢你，不辜负你；' +
      '凡违抗你的人，我们与他断绝、远离。主啊，我们只崇拜你，只为你礼拜和叩头，我们奔向你，勤于顺从你；' +
      '我们希望你的慈悯，畏惧你的惩罚，你的惩罚必定降临于不信的人。',
    src: { zh: "哈乃斐学派通行念法（《al-Bahr al-Ra'iq》）" },
  },
  istighfar: {
    ar: 'أَسْتَغْفِرُ اللَّهَ',
    tr: 'Astaghfirullah',
    zh: '我向真主求饶。',
    src: { zh: '穆斯林 591' },
  },
  antasSalam: {
    ar: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ، تَبَارَكْتَ ذَا الْجَلَالِ وَالْإِكْرَامِ',
    tr: 'Allahumma antas-salamu wa minkas-salam, tabarakta dhal-jalali wal-ikram',
    zh: '主啊，你是平安的主，平安来自于你；具有威严与尊荣的主啊，你多么吉庆！',
    src: { zh: '穆斯林 591' },
  },
  iftarDua: {
    ar: 'ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ',
    tr: "Dhahabaz-zama'u wabtallatil-'uruqu wa thabatal-ajru in sha' Allah",
    zh: '口渴消除了，血脉滋润了，若真主意欲，回赐已经确定。',
    src: { zh: '艾布·达乌德 2357（良好）' },
  },
  wuduDua: {
    ar:
      'أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، ' +
      'اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ، وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ',
    tr:
      "Ash-hadu an la ilaha illallahu wahdahu la sharika lah, wa ash-hadu anna Muhammadan 'abduhu wa rasuluh. " +
      "Allahummaj'alni minat-tawwabin, waj'alni minal-mutatahhirin",
    zh: '我作证：除真主外，再无应受崇拜的，他独一无偶；我作证：穆罕默德是他的仆人和使者。主啊，求你使我成为常常悔过的人，使我成为洁净的人。',
    src: { zh: '穆斯林 234；提尔密济 55' },
  },
};

// 礼拜后赞念（33 遍一组，最后一句凑满 100）
export const TASBIH = [
  { key: 'subhanallah', ar: 'سُبْحَانَ اللَّهِ', tr: 'Subhanallah', zh: '赞真主清净', count: 33 },
  { key: 'alhamdulillah', ar: 'الْحَمْدُ لِلَّهِ', tr: 'Alhamdulillah', zh: '一切赞颂全归真主', count: 33 },
  { key: 'allahuakbar', ar: 'اللَّهُ أَكْبَرُ', tr: 'Allahu akbar', zh: '真主至大', count: 33 },
];
export const TASBIH_100 = {
  ar: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
  tr: "La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu, wa huwa 'ala kulli shay'in qadir",
  zh: '除真主外，再无应受崇拜的，他独一无偶；国权归他，赞颂归他，他对万事是全能的。',
  src: { zh: '穆斯林 595、597' },
};

// 跟读用的短章：按经文顺序排列。哈乃斐学派中，后一拜念的章节宜在前一拜之后（按经文顺序）。
const SURAH_TR = {
  1: [
    'Bismillahir-rahmanir-rahim',
    "Al-hamdu lillahi rabbil-'alamin",
    'Ar-rahmanir-rahim',
    'Maliki yawmid-din',
    "Iyyaka na'budu wa iyyaka nasta'in",
    'Ihdinas-siratal-mustaqim',
    "Siratal-ladhina an'amta 'alayhim, ghayril-maghdubi 'alayhim wa lad-dallin",
  ],
  103: ["Wal-'asr", 'Innal-insana lafi khusr', "Illal-ladhina amanu wa 'amilus-salihati wa tawasaw bil-haqqi wa tawasaw bis-sabr"],
  108: ["Inna a'taynakal-kawthar", 'Fasalli li-rabbika wanhar', "Inna shani'aka huwal-abtar"],
  112: ['Qul huwallahu ahad', 'Allahus-samad', 'Lam yalid wa lam yulad', 'Wa lam yakul-lahu kufuwan ahad'],
  113: [
    "Qul a'udhu bi-rabbil-falaq",
    'Min sharri ma khalaq',
    'Wa min sharri ghasiqin idha waqab',
    "Wa min sharrin-naffathati fil-'uqad",
    'Wa min sharri hasidin idha hasad',
  ],
};
// 章名（按语言）
const SURAH_NAME = {
  1: { zh: '开端章' },
  103: { zh: '时光章' },
  108: { zh: '多福章' },
  112: { zh: '忠诚章' },
  113: { zh: '曙光章' },
};

export function surah(n) {
  const s = SURAHS[n];
  return {
    number: n,
    name: SURAH_NAME[n],
    nameAr: s.nameAr,
    ayahs: s.ayahs.map((a, i) => ({ ...a, tr: SURAH_TR[n][i] })),
    src: { zh: `《古兰经》第 ${n} 章，马坚译` },
  };
}

export { SHORT_SURAHS } from './prayers.js';
