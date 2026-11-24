// 五番拜的拜数（哈乃斐学派）与"跟着做"的步骤生成
//
// 拜数：
//   晨礼  2 逊奈（强调）+ 2 主命
//   晌礼  4 逊奈（强调）+ 4 主命 + 2 逊奈（强调）
//   晡礼  4 逊奈（非强调，可选）+ 4 主命
//   昏礼  3 主命 + 2 逊奈（强调）
//   宵礼  4 逊奈（非强调，可选）+ 4 主命 + 2 逊奈（强调）+ 3 威特尔（瓦直卜）
// 主麻日：去不了清真寺的人（如因大雪、严寒、生病）在家礼晌礼 4 拜，不礼主麻 2 拜。
//
// 步骤要点（哈乃斐学派）：
// - 主命拜第 3、4 拜只念开端章；逊奈拜、威特尔拜每一拜都念开端章 + 一段经文
// - 3 拜、4 拜的礼拜在第 2 拜后坐下念作证词，然后起立
// - 威特尔第 3 拜：念完经文后举手念大赞词，再念古努特，然后鞠躬
// 跟读用的短章，按经文顺序：时光章、多福章、忠诚章、曙光章（哈乃斐学派中后一拜宜念经文顺序靠后的章）
export const SHORT_SURAHS = [103, 108, 112, 113];

export const PRAYER_INFO = {
  fajr: {
    ar: 'الفَجْر',
    loud: true,
    units: [
      { id: 'sunnah', kind: 'sunnah', rakats: 2, when: 'before', strong: true },
      { id: 'fard', kind: 'fard', rakats: 2 },
    ],
  },
  dhuhr: {
    ar: 'الظُّهْر',
    loud: false,
    units: [
      { id: 'sunnah-before', kind: 'sunnah', rakats: 4, when: 'before', strong: true },
      { id: 'fard', kind: 'fard', rakats: 4 },
      { id: 'sunnah-after', kind: 'sunnah', rakats: 2, when: 'after', strong: true },
    ],
  },
  asr: {
    ar: 'العَصْر',
    loud: false,
    units: [
      { id: 'sunnah', kind: 'sunnah', rakats: 4, when: 'before', strong: false },
      { id: 'fard', kind: 'fard', rakats: 4 },
    ],
  },
  maghrib: {
    ar: 'المَغْرِب',
    loud: true,
    units: [
      { id: 'fard', kind: 'fard', rakats: 3 },
      { id: 'sunnah', kind: 'sunnah', rakats: 2, when: 'after', strong: true },
    ],
  },
  isha: {
    ar: 'العِشَاء',
    loud: true,
    units: [
      { id: 'sunnah-before', kind: 'sunnah', rakats: 4, when: 'before', strong: false },
      { id: 'fard', kind: 'fard', rakats: 4 },
      { id: 'sunnah-after', kind: 'sunnah', rakats: 2, when: 'after', strong: true },
      { id: 'witr', kind: 'witr', rakats: 3 },
    ],
  },
};

// 斋月的间歇拜（泰拉威）：哈乃斐学派为 20 拜，每 2 拜一出拜，是强调的圣行，在宵礼之后、威特尔之前礼。
export const EXTRA_PRAYERS = {
  tarawih: {
    ar: 'التَّرَاوِيح',
    loud: true,
    units: [{ id: 'set', kind: 'sunnah', rakats: 2, when: 'after', strong: true, loudOk: true }],
  },
};

export function getPrayerInfo(key) {
  return PRAYER_INFO[key] || EXTRA_PRAYERS[key] || null;
}

/**
 * 这一部分拜的名称和标签：返回语言词条的键和变量，由界面用 t() 显示。
 * level：fard 必须 / sunnah 圣行 / optional 圣行·可选
 */
export function unitLabel(unit) {
  if (unit.kind === 'fard') return { name: ['unit.fard', { n: unit.rakats }], tag: 'tag.fard', level: 'fard' };
  if (unit.kind === 'witr') return { name: ['unit.witr', { n: unit.rakats }], tag: 'tag.wajib', level: 'fard' };
  return {
    name: [unit.when === 'before' ? 'unit.sunnahBefore' : 'unit.sunnahAfter', { n: unit.rakats }],
    tag: unit.strong ? 'tag.sunnah' : 'tag.optional',
    level: unit.strong ? 'sunnah' : 'optional',
  };
}

/**
 * 生成跟做步骤。步骤里不写文字，只写"是哪一步"（id），文字在语言文件 step.<id>.* 里：
 *   step.<id>.title 标题 / step.<id>.how 怎么做 / step.<id>.women 女士 / step.<id>.note 提示
 * 每一步：{ id, posture, rakah, vars, ar, items:[{k, repeat, side}] | [{surah}], women, note, howKey }
 * posture：stand 站立 / raise 举手 / ruku 鞠躬 / sujud 叩头 / sit 坐
 */
export function buildSteps(prayerKey, unitId) {
  const info = getPrayerInfo(prayerKey);
  const unit = info.units.find((u) => u.id === unitId) || info.units[0];
  const n = unit.rakats;
  const steps = [];
  const loud = (unit.kind === 'fard' || unit.loudOk) && info.loud;
  const add = (id, posture, rakah, ar, items, extra = {}) => steps.push({ id, posture, rakah, ar, items, vars: {}, ...extra });

  for (let r = 1; r <= n; r++) {
    if (r === 1) {
      add('niyyah', 'stand', r, 'النِّيَّة', [], { vars: { prayer: prayerKey, n, kind: unit.kind } });
      add('takbirTahrima', 'raise', r, 'تَكْبِيرَةُ الإِحْرَام', [{ k: 'takbir' }], { women: true });
      add('thana', 'stand', r, 'الثَّنَاء', [{ k: 'thana' }]);
      add('taawwudh', 'stand', r, 'التَّعَوُّذ وَالتَّسْمِيَة', [{ k: 'taawwudh' }, { k: 'basmala' }]);
    } else {
      add('rise', 'stand', r, 'القِيَام', [{ k: 'takbir' }, { k: 'basmala' }], { vars: { r } });
    }
    // 开端章的说明：前两拜（可出声的拜）/ 前两拜（低声）/ 第 3、4 拜
    add('fatiha', 'stand', r, 'الفَاتِحَة', [{ surah: 1 }, { k: 'amin' }], {
      howKey: r <= 2 ? (loud ? 'step.fatiha.howLoud' : 'step.fatiha.howQuiet') : 'step.fatiha.howLater',
    });
    if (unit.kind !== 'fard' || r <= 2) {
      add('surah', 'stand', r, 'السُّورَة', [{ surah: SHORT_SURAHS[(r - 1) % SHORT_SURAHS.length] }]);
    }
    if (unit.kind === 'witr' && r === n) {
      add('qunut', 'raise', r, 'القُنُوت', [{ k: 'takbir' }, { k: 'qunut' }], { note: true });
    }
    add('ruku', 'ruku', r, 'الرُّكُوع', [{ k: 'takbir' }, { k: 'ruku', repeat: 3 }], { women: true });
    add('qawmah', 'stand', r, 'القَوْمَة', [{ k: 'tasmi' }, { k: 'tahmid' }]);
    add('sujud1', 'sujud', r, 'السَّجْدَة', [{ k: 'takbir' }, { k: 'sujud', repeat: 3 }], { women: true });
    add('jalsa', 'sit', r, 'الجَلْسَة', [{ k: 'takbir' }]);
    add('sujud2', 'sujud', r, 'السَّجْدَة الثَّانِيَة', [{ k: 'takbir' }, { k: 'sujud', repeat: 3 }]);
    if (r === n) {
      add('qadahFinal', 'sit', r, 'القَعْدَة الأَخِيرَة', [{ k: 'takbir' }, { k: 'tashahhud' }, { k: 'salawat' }, { k: 'rabbana' }], { women: true });
      add('salam', 'sit', r, 'السَّلَام', [{ k: 'salam', side: 'right' }, { k: 'salam', side: 'left' }]);
    } else if (r === 2) {
      add('qadahFirst', 'sit', r, 'القَعْدَة الأُولَى', [{ k: 'takbir' }, { k: 'tashahhud' }], { women: true });
    }
  }
  return { unit, steps, label: unitLabel(unit), info };
}

/** 礼拜完成后的念词 */
export const AFTER_PRAYER = [{ k: 'istighfar', repeat: 3 }, { k: 'antasSalam' }];
