// 远程开关和用户设置决定的几个"闸门"（很小，随首屏加载；具体功能按需加载）
let stats = () => false;
let presence = () => true;
export const setStatsGate = (fn) => (stats = fn);
export const statsOn = () => stats();
export const setPresenceGate = (fn) => (presence = fn);
export const presenceOn = () => presence();
