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
    zh: '晨礼',
    ar: 'الفَجْر',
    loud: true,
    units: [
      { id: 'sunnah', kind: 'sunnah', rakats: 2, when: 'before', strong: true },
      { id: 'fard', kind: 'fard', rakats: 2 },
    ],
  },
  dhuhr: {
    zh: '晌礼',
    ar: 'الظُّهْر',
    loud: false,
    units: [
      { id: 'sunnah-before', kind: 'sunnah', rakats: 4, when: 'before', strong: true },
      { id: 'fard', kind: 'fard', rakats: 4 },
      { id: 'sunnah-after', kind: 'sunnah', rakats: 2, when: 'after', strong: true },
    ],
  },
  asr: {
    zh: '晡礼',
    ar: 'العَصْر',
    loud: false,
    units: [
      { id: 'sunnah', kind: 'sunnah', rakats: 4, when: 'before', strong: false },
      { id: 'fard', kind: 'fard', rakats: 4 },
    ],
  },
  maghrib: {
    zh: '昏礼',
    ar: 'المَغْرِب',
    loud: true,
    units: [
      { id: 'fard', kind: 'fard', rakats: 3 },
      { id: 'sunnah', kind: 'sunnah', rakats: 2, when: 'after', strong: true },
    ],
  },
  isha: {
    zh: '宵礼',
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
    zh: '间歇拜',
    ar: 'التَّرَاوِيح',
    loud: true,
    units: [{ id: 'set', kind: 'sunnah', rakats: 2, when: 'after', strong: true, loudOk: true }],
  },
};

export function getPrayerInfo(key) {
  return PRAYER_INFO[key] || EXTRA_PRAYERS[key] || null;
}

export function unitLabel(unit) {
  if (unit.kind === 'fard') return { name: `${unit.rakats} 拜主命`, tag: '必须', level: 'fard' };
  if (unit.kind === 'witr') return { name: `${unit.rakats} 拜威特尔`, tag: '必须（瓦直卜）', level: 'fard' };
  const pos = unit.when === 'before' ? '前' : '后';
  return {
    name: `${pos} ${unit.rakats} 拜逊奈`,
    tag: unit.strong ? '圣行' : '圣行·可选',
    level: unit.strong ? 'sunnah' : 'optional',
  };
}

/**
 * 生成跟做步骤。
 * 每一步：{ posture, rakah, title, ar, how, women, items:[{k, repeat}] | [{surah}], note }
 * posture：stand 站立 / raise 举手 / ruku 鞠躬 / sujud 叩头 / sit 坐
 */
export function buildSteps(prayerKey, unitId) {
  const info = getPrayerInfo(prayerKey);
  const unit = info.units.find((u) => u.id === unitId) || info.units[0];
  const n = unit.rakats;
  const kindName = unit.kind === 'fard' ? '主命' : unit.kind === 'witr' ? '威特尔' : '逊奈';
  const steps = [];
  const quiet =
    (unit.kind === 'fard' || unit.loudOk) && info.loud
      ? '一个人礼拜时，前两拜可以出声念，也可以低声念。'
      : '低声念，自己能听见即可。';

  for (let r = 1; r <= n; r++) {
    if (r === 1) {
      steps.push({
        posture: 'stand',
        rakah: r,
        title: '举意',
        ar: 'النِّيَّة',
        how: `站好，面向朝向。在心里想好：我为真主礼${info.zh}的${n} 拜${kindName}。用自己的话想即可，不必念出声。`,
        items: [],
      });
      steps.push({
        posture: 'raise',
        rakah: r,
        title: '入拜大赞词',
        ar: 'تَكْبِيرَةُ الإِحْرَام',
        how: '双手举到耳边（拇指接近耳垂），手心朝前，念大赞词。然后双手放下，右手搭在左手上，放在肚脐下面。',
        women: '女士：双手举到肩部，念完后双手放在胸前。',
        items: [{ k: 'takbir' }],
      });
      steps.push({
        posture: 'stand',
        rakah: r,
        title: '赞主词',
        ar: 'الثَّنَاء',
        how: '站着，眼睛看叩头的地方，低声念。',
        items: [{ k: 'thana' }],
      });
      steps.push({
        posture: 'stand',
        rakah: r,
        title: '求护词、太斯米',
        ar: 'التَّعَوُّذ وَالتَّسْمِيَة',
        how: '低声念。',
        items: [{ k: 'taawwudh' }, { k: 'basmala' }],
      });
    } else {
      steps.push({
        posture: 'stand',
        rakah: r,
        title: `起立，开始第 ${r} 拜`,
        ar: 'القِيَام',
        how: '念着大赞词站起来，双手像第一拜那样放好，再低声念太斯米。',
        items: [{ k: 'takbir' }, { k: 'basmala' }],
      });
    }

    steps.push({
      posture: 'stand',
      rakah: r,
      title: '开端章',
      ar: 'الفَاتِحَة',
      how: (r <= 2 ? quiet : '低声念。') + '念完后轻声说"阿敏"。',
      items: [{ surah: 1 }, { k: 'amin' }],
    });

    const needSurah = unit.kind !== 'fard' || r <= 2;
    if (needSurah) {
      steps.push({
        posture: 'stand',
        rakah: r,
        title: '再念一段经文',
        ar: 'السُّورَة',
        how: '念一章或至少三节经文。会背哪章念哪章；这里按经文顺序给出几章短章作示例。',
        items: [{ surah: SHORT_SURAHS[(r - 1) % SHORT_SURAHS.length] }],
      });
    }

    if (unit.kind === 'witr' && r === n) {
      steps.push({
        posture: 'raise',
        rakah: r,
        title: '举手，念古努特',
        ar: 'القُنُوت',
        how: '念完经文后，双手像入拜时那样举起，念大赞词，然后双手放好，低声念古努特。',
        items: [{ k: 'takbir' }, { k: 'qunut' }],
        note: '还不会背古努特的，可以先念"我们的主啊，求你在今世赏赐我们美好的……"（2:201），同时抓紧学会古努特。',
      });
    }

    steps.push({
      posture: 'ruku',
      rakah: r,
      title: '鞠躬',
      ar: 'الرُّكُوع',
      how: '念着大赞词弯腰，双手扶住膝盖、手指张开，背和头放平。',
      women: '女士：弯腰稍浅，手放在膝上，手指并拢。',
      items: [{ k: 'takbir' }, { k: 'ruku', repeat: 3 }],
    });
    steps.push({
      posture: 'stand',
      rakah: r,
      title: '起身站直',
      ar: 'القَوْمَة',
      how: '起身时念第一句，站直后念第二句，稍停片刻。',
      items: [{ k: 'tasmi' }, { k: 'tahmid' }],
    });
    steps.push({
      posture: 'sujud',
      rakah: r,
      title: '第一次叩头',
      ar: 'السَّجْدَة',
      how: '念着大赞词叩头：先膝盖着地，再双手，然后鼻子和额头，双手放在头的两侧。',
      women: '女士：身体收拢，手臂贴近身体，腹部贴近大腿。',
      items: [{ k: 'takbir' }, { k: 'sujud', repeat: 3 }],
    });
    steps.push({
      posture: 'sit',
      rakah: r,
      title: '坐起片刻',
      ar: 'الجَلْسَة',
      how: '念着大赞词坐起来，身体坐稳、停一下。',
      items: [{ k: 'takbir' }],
    });
    steps.push({
      posture: 'sujud',
      rakah: r,
      title: '第二次叩头',
      ar: 'السَّجْدَة الثَّانِيَة',
      how: '念着大赞词再叩头，和第一次一样。',
      items: [{ k: 'takbir' }, { k: 'sujud', repeat: 3 }],
    });

    if (r === n) {
      steps.push({
        posture: 'sit',
        rakah: r,
        title: '最后的坐',
        ar: 'القَعْدَة الأَخِيرَة',
        how: '念着大赞词坐起来：坐在左脚上，右脚竖起、脚趾朝前，双手放在大腿上。依次念作证词、赞圣词和祈祷词。念到"لَا إِلَهَ"时可以抬起右手食指，念到"إِلَّا اللَّهُ"时放下。',
        women: '女士：双脚从右侧伸出，坐在地上。',
        items: [{ k: 'takbir' }, { k: 'tashahhud' }, { k: 'salawat' }, { k: 'rabbana' }],
      });
      steps.push({
        posture: 'sit',
        rakah: r,
        title: '出拜',
        ar: 'السَّلَام',
        how: '先向右转头念出拜词，再向左转头念一遍。礼拜到这里完成。',
        items: [{ k: 'salam', side: '向右' }, { k: 'salam', side: '向左' }],
      });
    } else if (r === 2) {
      steps.push({
        posture: 'sit',
        rakah: r,
        title: '第一次坐',
        ar: 'القَعْدَة الأُولَى',
        how: '念着大赞词坐起来：坐在左脚上，右脚竖起、脚趾朝前。只念作证词，念完不要停留，接着起立礼下一拜。',
        women: '女士：双脚从右侧伸出，坐在地上。',
        items: [{ k: 'takbir' }, { k: 'tashahhud' }],
      });
    }
  }
  return { unit, steps, label: unitLabel(unit), info };
}

/** 礼拜完成后的念词 */
export const AFTER_PRAYER = [{ k: 'istighfar', repeat: 3 }, { k: 'antasSalam' }];
