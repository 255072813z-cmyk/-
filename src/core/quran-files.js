// 古兰经数据块的加载入口（构建时由 Vite 展开成按需下载的文件；单独放一个模块，好让测试能直接用 quran.js）
export const FILES = import.meta.glob('../content/quran/{ar,tg,ru,zh}-*.js');
