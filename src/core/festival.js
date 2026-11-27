// 节日氛围：斋月、开斋节、古尔邦节等日子，首页换一句问候语和一个小装饰（颜色微调、一个小图标），不改版面。
// 日期按伊斯兰历推算（跟随当地宣布的调整），和斋月页、封斋页用的是同一套。
// 问候语只用穆斯林之间通用的祝福，不附加教法说法：
//   开斋节、古尔邦节："愿真主接受我们和你们的功修"（تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ，圣门弟子过节时互相这样祝福）
import { toHijri } from './hijri.js';

/**
 * 今天是什么日子：{ id, ar, tone } 或 null。
 * id：ramadan / qadr（斋月最后十天）/ fitr（开斋节 1–3 日）/ dhul（都尔黑哲月头八天）/ arafah / adha（古尔邦节 4 天）/ newyear / ashura
 * tone：首页颜色的微调（night 夜蓝、gold 金色、green 绿色）
 */
export function festivalOf(ymd, adjust = 0) {
  const h = toHijri(ymd, adjust);
  if (h.m === 9) return h.d >= 21 ? { id: 'qadr', ar: 'رَمَضَانُ مُبَارَك', tone: 'night' } : { id: 'ramadan', ar: 'رَمَضَانُ مُبَارَك', tone: 'night' };
  if (h.m === 10 && h.d <= 3) return { id: 'fitr', ar: 'تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ', tone: 'gold' };
  if (h.m === 12 && h.d <= 8) return { id: 'dhul', ar: '', tone: 'green' };
  if (h.m === 12 && h.d === 9) return { id: 'arafah', ar: '', tone: 'green' };
  if (h.m === 12 && h.d >= 10 && h.d <= 13) return { id: 'adha', ar: 'تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ', tone: 'gold' };
  if (h.m === 1 && h.d === 1) return { id: 'newyear', ar: '', tone: 'green', y: h.y };
  if (h.m === 1 && h.d === 10) return { id: 'ashura', ar: '', tone: 'green' };
  return null;
}
