// 乌兹别克语西里尔字母 → 拉丁字母（古兰经译文用）：按现行正字法逐条检查
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uzLatin } from '../scripts/uz-latin.mjs';

test('乌兹别克语转拉丁字母：ў ғ қ ҳ、ш ч、е/ё/ю/я、ъ、ц、大小写', () => {
  const cases = [
    ['Аллоҳнинг номи билан', 'Allohning nomi bilan'],
    ['Ўзбекистон', 'Oʻzbekiston'],
    ['тўғри', 'toʻgʻri'],
    ['Қуръони Карим', 'Qurʼoni Karim'],
    ['мўъмин', 'moʻmin'], // ўъ 后面的 ъ 不写
    ['Ер юзида', 'Yer yuzida'], // 词首 е → ye
    ['келди', 'keldi'],
    ['Ёки дунё', 'Yoki dunyo'],
    ['Исҳоқ', 'Isʼhoq'], // s 和 h 分开读
    ['ШАЙТОН', 'SHAYTON'],
    ['Шайтон', 'Shayton'],
    ['милиция', 'militsiya'],
    ['Cаҳобаи (c. а. в.)', 'Sahobai (s. a. v.)'], // 混进的拉丁字母 C/c 先换回西里尔字母
  ];
  for (const [cyr, lat] of cases) assert.equal(uzLatin(cyr), lat, cyr);
});
