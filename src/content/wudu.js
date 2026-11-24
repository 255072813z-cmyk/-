// 小净步骤（哈乃斐学派）
// 依据：《古兰经》5:6（四项主命）；哈乃斐学派教法书（如《Nur al-Idah》）中的圣行与可嘉行为。
// level：fard 主命（必须）/ sunnah 圣行 / mustahab 可嘉（做了更好）
// zone：插图上要高亮的身体部位
export const WUDU_STEPS = [
  {
    zone: 'none',
    level: 'sunnah',
    title: '举意，念太斯米',
    how: '心里想好：我为了礼拜做小净。开始时念"奉真主之名"。',
    items: [{ k: 'basmala' }],
  },
  {
    zone: 'hands',
    level: 'sunnah',
    title: '洗双手',
    count: 3,
    how: '把双手洗到手腕，手指之间也要洗到。戴着戒指的，转动一下让水进去。',
  },
  {
    zone: 'mouth',
    level: 'sunnah',
    title: '漱口',
    count: 3,
    how: '右手捧水入口，漱后吐出。',
    note: '封斋时轻轻漱，不要让水进入喉咙。',
  },
  {
    zone: 'nose',
    level: 'sunnah',
    title: '呛鼻',
    count: 3,
    how: '右手把水吸进鼻腔，再用左手擤出。',
    note: '封斋时不要吸得太深。',
  },
  {
    zone: 'face',
    level: 'fard',
    title: '洗脸',
    count: 3,
    how: '从额头发际到下巴，从一边耳垂到另一边耳垂，整张脸都要洗到。有胡须的，用湿手指梳过胡须。',
    fardNote: '洗到一遍是主命，洗三遍是圣行。',
  },
  {
    zone: 'arms',
    level: 'fard',
    title: '洗双臂（连同手肘）',
    count: 3,
    how: '先右后左，从手指洗到手肘，手肘要一起洗到。',
    fardNote: '洗到一遍是主命，洗三遍是圣行。',
  },
  {
    zone: 'head',
    level: 'fard',
    title: '抹头',
    count: 1,
    how: '双手沾湿，从前额向后抹到后脑，再抹回来。',
    fardNote: '至少抹到头的四分之一是主命，抹全头是圣行。',
  },
  {
    zone: 'ears',
    level: 'sunnah',
    title: '抹耳',
    count: 1,
    how: '用食指抹耳朵里面，用拇指抹耳朵背面。',
  },
  {
    zone: 'neck',
    level: 'mustahab',
    title: '抹后颈',
    count: 1,
    how: '用双手手背抹后颈，不抹喉咙。',
  },
  {
    zone: 'feet',
    level: 'fard',
    title: '洗双脚（连同脚踝）',
    count: 3,
    how: '先右后左，洗到脚踝以上，用左手小指搓洗脚趾之间。',
    fardNote: '洗到一遍是主命，洗三遍是圣行。',
  },
  {
    zone: 'done',
    level: 'sunnah',
    title: '小净后的作证',
    how: '做完小净，面向朝向念作证词和祈祷词。',
    items: [{ k: 'wuduDua' }],
  },
];

export const WUDU_FACTS = {
  fard: '小净的主命只有四项：洗脸、洗双臂到手肘、抹头（至少四分之一）、洗双脚到脚踝（《古兰经》5:6）。按顺序、不间断地做完，并且每处洗三遍，是圣行。',
  winter: [
    '冬天用温水做小净完全可以，和用冷水一样有效。',
    '穿着皮袜（马赫斯）的：如果是在有小净的时候穿上的，之后做小净可以不脱，用湿手指在皮袜脚面上从脚趾向小腿抹一次。在家的人可以这样抹一昼夜（24 小时），从穿上后第一次坏小净时算起。',
    '普通的薄棉袜、毛袜按哈乃斐学派不能抹。拿不准自己的袜子能不能抹，请问当地伊玛目。',
  ],
  breakers: [
    '大小便、放屁',
    '身体流出血或脓，并且流开',
    '满口的呕吐',
    '躺着或靠着东西睡着',
    '昏迷、醉',
    '礼拜中出声大笑（成年人）',
  ],
};
