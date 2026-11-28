# 用法：python3 scripts/data/build-duas.py <放圣训原文 JSON 的目录> src/content/duas.js
# 原文来自 https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-<书>/<编号>.json（穆斯林用全本 ara-muslim.json，按 arabicnumber 找）
# 生成 src/content/duas.js：阿拉伯文从圣训原文逐字截取（去掉符号后定位，再从带符号的原文截出），截不到就报错
import json, re, sys
D = sys.argv[1]; OUT = sys.argv[2]
MARK = re.compile(r'[ً-ْٰـ]')
clean = lambda s: re.sub(r'[‏‎]', '', s).strip()
def body(name): return clean(json.load(open(f'{D}/ara-{name}.json'))['hadiths'][0]['text'])
def muslim(num, kw):
    for h in json.load(open(f'{D}/ara-muslim-all.json'))['hadiths']:
        if str(h.get('arabicnumber', '')).split('.')[0] == str(num) and kw in MARK.sub('', h['text']): return clean(h['text'])
    raise SystemExit(f'no muslim {num}')
def cut(src, start, end):
    keep = [i for i, c in enumerate(src) if not MARK.match(c)]
    bare = ''.join(src[i] for i in keep)
    b0, b1 = MARK.sub('', start), MARK.sub('', end)
    i = bare.index(b0); j = bare.index(b1, i) + len(b1)
    a, z = keep[i], keep[j - 1] + 1
    while z < len(src) and MARK.match(src[z]): z += 1
    out = src[a:z].replace('،', '').replace('  ', ' ')
    assert MARK.sub('', out).replace(' ', '') in MARK.sub('', src).replace(' ', '').replace('،', ''), 'not in source'
    return out
SRC = {
  'b': ['布哈里 {n}', 'Бухорӣ, {n}', 'аль-Бухари, {n}', 'Buxoriy, {n}', 'Бухари, {n}'],
  'm': ['穆斯林 {n}', 'Муслим, {n}', 'Муслим, {n}', 'Muslim, {n}', 'Муслим, {n}'],
  'd': ['艾布·达乌德 {n}', 'Абӯдовуд, {n}', 'Абу Дауд, {n}', 'Abu Dovud, {n}', 'Абу Дауд, {n}'],
}
L = ['zh', 'tg', 'ru', 'uz', 'ky']
def src(*refs):
    return {l: '、'.join(SRC[k][i].format(n=n) for k, n in refs) if l == 'zh' else '; '.join(SRC[k][i].format(n=n) for k, n in refs) for i, l in enumerate(L)}
def five(a): return dict(zip(L, a))
B = lambda n: body(f'bukhari-{n}'); AD = lambda n: body(f'abudawud-{n}')
ITEMS = [
 dict(id='eat', cat='food', ar=cut(AD(3767), 'بسم الله', 'بسم الله'), tr='Bismillāh', trc=dict(tg='Бисмиллоҳ', ru='Бисмиллях', uz='Bismilloh'),
  title=five(['吃饭前', 'Пеш аз хӯрок', 'Перед едой', 'Ovqatdan oldin', 'Тамактан мурун']),
  mean=five(['奉真主之名。', 'Ба номи Аллоҳ.', 'С именем Аллаха.', 'Alloh nomi bilan.', 'Аллахтын аты менен.']),
  src=src(('b', 5376), ('d', 3767))),
 dict(id='eatForgot', cat='food', ar=cut(AD(3767), 'بسم الله أوله', 'وآخره'), tr='Bismillāhi awwalahu wa ākhirah', trc=dict(tg='Бисмиллоҳи аввалаҳу ва охираҳ', ru='Бисмилляхи аввалаху ва ахырах', uz='Bismillohi avvalahu va oxirah'),
  title=five(['开头忘了念', 'Агар аввал фаромӯш кардед', 'Если забыли в начале', 'Boshida unutgan boʻlsangiz', 'Башында унутуп калсаңыз']),
  mean=five(['奉真主之名，从开头到结尾。', 'Ба номи Аллоҳ, аз аввал то охираш.', 'С именем Аллаха — в начале и в конце.', 'Alloh nomi bilan — boshida ham, oxirida ham.', 'Аллахтын аты менен — башында да, аягында да.']),
  src=src(('d', 3767))),
 dict(id='afterEat', cat='food', ar=cut(AD(4023), 'الحمد لله الذي أطعمني', 'ولا قوة'), tr='Al-ḥamdu lillāhil-ladhī aṭʿamanī hādhaṭ-ṭaʿāma wa razaqanīhi min ghayri ḥawlin minnī wa lā quwwah',
  trc=dict(tg='Алҳамду лиллоҳил-лазӣ атъаманӣ ҳазат-таъома ва разақанӣҳи мин ғайри ҳавлин миннӣ ва ло қувваҳ', ru='Альхамду лилляхи-ллязи атъамани хаза-т-таъама ва разаканихи мин гайри хауль минни ва ля куввах', uz='Alhamdu lillahil-laziy atʼamaniy hazat-taʼoma va razaqaniyhi min gʻayri havlin minniy va lo quvvah'),
  title=five(['吃完饭', 'Баъд аз хӯрок', 'После еды', 'Ovqatdan keyin', 'Тамактан кийин']),
  mean=five(['一切赞颂全归真主，他给我吃了这顿饭，供给了我，并不是靠我自己的能力和力量。', 'Ҳамду сано Аллоҳро, ки ин таомро ба ман хӯронд ва ризқ дод, бе қудрат ва тавони ман.', 'Хвала Аллаху, Который накормил меня этой едой и наделил ею без всякой силы и мощи с моей стороны.', 'Menga bu taomni yediragan va meni u bilan rizqlantirgan Allohga hamd boʻlsin — mening kuch-quvvatimsiz.', 'Мага бул тамакты жедирип, ырыскы кылган Аллахка мактоо болсун — менин күчүм жана кубатым болбосо да.']),
  src=src(('d', 4023))),
 dict(id='leaveHome', cat='home', ar=cut(AD(5095), 'بسم الله توكلت', 'إلا بالله'), tr='Bismillāh, tawakkaltu ʿalallāh, lā ḥawla wa lā quwwata illā billāh',
  trc=dict(tg='Бисмиллоҳ, таваккалту ъалаллоҳ, ло ҳавла ва ло қуввата илло биллоҳ', ru='Бисмиллях, таваккальту аля-Ллах, ля хауля ва ля куввата илля би-Ллях', uz='Bismilloh, tavakkaltu ʼalalloh, lo havla va lo quvvata illo billoh'),
  title=five(['出门时', 'Ҳангоми аз хона баромадан', 'Выходя из дома', 'Uydan chiqayotganda', 'Үйдөн чыгып жатканда']),
  mean=five(['奉真主之名，我信托真主；无能为力，只有凭借真主。', 'Ба номи Аллоҳ, ба Аллоҳ таваккал кардам; ҳеҷ қудрат ва қувват нест, ҷуз аз ҷониби Аллоҳ.', 'С именем Аллаха, уповаю на Аллаха; нет силы и мощи ни у кого, кроме Аллаха.', 'Alloh nomi bilan, Allohga tavakkul qildim; kuch va quvvat faqat Alloh bilandir.', 'Аллахтын аты менен, Аллахка таваккул кылдым; күч-кубат Аллах менен гана.']),
  src=src(('d', 5095))),
 dict(id='sleep', cat='sleep', ar=cut(B(6324), 'باسمك اللهم', 'وأحيا'), tr='Bismika Allāhumma amūtu wa aḥyā', trc=dict(tg='Бисмика-ллоҳумма амуту ва аҳё', ru='Бисмика-Ллахумма амуту ва ахья', uz='Bismikallohumma amutu va ahyo'),
  title=five(['睡觉前', 'Пеш аз хоб', 'Перед сном', 'Uxlashdan oldin', 'Уктаардан мурун']),
  mean=five(['主啊，我奉你的名而死，奉你的名而生。', 'Худоё, бо номи Ту мемирам ва зинда мешавам.', 'С Твоим именем, о Аллах, я умираю и оживаю.', 'Allohim, Sening noming bilan oʻlaman va tiriламан.'.replace('ламан','laman'), 'Аллахым, Сенин атың менен өлөм жана тириlem.'.replace('тириlem','тирилем')]),
  src=src(('b', 6324))),
 dict(id='wake', cat='sleep', ar=cut(B(6324), 'الحمد لله الذي أحيانا', 'النشور'), tr='Al-ḥamdu lillāhil-ladhī aḥyānā baʿda mā amātanā wa ilayhin-nushūr',
  trc=dict(tg='Алҳамду лиллоҳил-лазӣ аҳёно баъда мо аматано ва илайҳин-нушур', ru='Альхамду лилляхи-ллязи ахъяна баъда ма аматана ва иляйхи-н-нушур', uz='Alhamdu lillahil-laziy ahyono baʼda mo amatano va ilayhin-nushur'),
  title=five(['醒来时', 'Ҳангоми бедор шудан', 'Проснувшись', 'Uygʻonganda', 'Ойгонгондо']),
  mean=five(['一切赞颂全归真主，他使我们死后又使我们复生，我们终要回到他那里。', 'Ҳамду сано Аллоҳро, ки моро баъд аз миронданамон зинда кард ва бозгашт ба сӯи Ӯст.', 'Хвала Аллаху, Который оживил нас после того, как умертвил, и к Нему — воскрешение.', 'Bizni oʻldirganidan keyin tiriltirgan Allohga hamd boʻlsin, qaytish Uning huzuriga.', 'Бизди өлтүргөндөн кийин тирилткен Аллахка мактоо болсун, кайтуу Ага.']),
  src=src(('b', 6324))),
 dict(id='toiletIn', cat='clean', ar=cut(B(142), 'اللهم إني أعوذ بك من الخبث', 'والخبائث'), tr='Allāhumma innī aʿūdhu bika minal-khubuthi wal-khabāʾith',
  trc=dict(tg='Аллоҳумма иннӣ аъузу бика минал-хубуси вал-хабоис', ru='Аллахумма инни аъузу бика миналь-хубуси валь-хабаис', uz='Allohumma inniy aʼuzu bika minal-xubusi val-xabois'),
  title=five(['进厕所前', 'Пеш аз даромадан ба ҳоҷатхона', 'Перед входом в уборную', 'Hojatxonaga kirishdan oldin', 'Ажаканага кирерден мурун']),
  mean=five(['主啊，我求你护佑，免遭男女恶魔的伤害。', 'Худоё, аз шайтонҳои нар ва мода ба Ту паноҳ мебарам.', 'О Аллах, прибегаю к Тебе от злых духов мужского и женского пола.', 'Allohim, erkak va urgʻochi shaytonlardan Senga panoh tilayman.', 'Аллахым, эркек жана ургаачы шайтандардан Сага сыйынам.']),
  src=src(('b', 142))),
 dict(id='toiletOut', cat='clean', ar=cut(AD(30), 'غفرانك', 'غفرانك'), tr='Ghufrānak', trc=dict(tg='Ғуфронак', ru='Гуфранак', uz='Gʻufronak'),
  title=five(['出厕所后', 'Баъд аз баромадан аз ҳоҷатхона', 'Выйдя из уборной', 'Hojatxonadan chiqqach', 'Ажаканадан чыккандан кийин']),
  mean=five(['（主啊，）求你饶恕。', '(Худоё,) омурзиши Туро мехоҳам.', '(О Аллах,) прошу Твоего прощения.', '(Allohim,) magʻfiratingni soʻrayman.', '(Аллахым,) кечиримиңди сурайм.']),
  src=src(('d', 30))),
 dict(id='afterWudu', cat='clean', ar=cut(muslim(234, 'أشهد'), 'أشهد أن لا إله إلا الله', 'ورسوله'), tr='Ashhadu an lā ilāha illallāh, wa anna Muḥammadan ʿabdullāhi wa rasūluh',
  trc=dict(tg='Ашҳаду ан ло илоҳа иллаллоҳ, ва анна Муҳаммадан ъабдуллоҳи ва расулуҳ', ru='Ашхаду алля иляха илля-Ллах, ва анна Мухаммадан абдуллахи ва расулюх', uz='Ashhadu an lo ilaha illalloh, va anna Muhammadan ʼabdullohi va rasuluh'),
  title=five(['小净之后', 'Баъд аз таҳорат', 'После омовения', 'Tahoratdan keyin', 'Даараттан кийин']),
  mean=five(['我作证：除真主外，绝无应受崇拜的；我作证：穆罕默德是真主的仆人和使者。', 'Шаҳодат медиҳам, ки ҷуз Аллоҳ маъбуде нест ва Муҳаммад бандаву фиристодаи Аллоҳ аст.', 'Свидетельствую, что нет божества, кроме Аллаха, и что Мухаммад — раб Аллаха и Его посланник.', 'Guvohlik beramanki, Allohdan oʻzga iloh yoʻq va Muhammad Allohning bandasi va elchisidir.', 'Күбөлөндүрөм: Аллахтан башка кудай жок жана Мухаммад — Аллахтын кулу жана элчиси.']),
  src=src(('m', 234))),
 dict(id='mosqueIn', cat='mosque', ar=cut(muslim(713, 'افتح'), 'اللهم افتح لي', 'رحمتك'), tr='Allāhummaftaḥ lī abwāba raḥmatik', trc=dict(tg='Аллоҳумма-фтаҳ лӣ абвоба раҳматик', ru='Аллахумма-фтах ли абваба рахматик', uz='Allohummaftah liy abvoba rahmatik'),
  title=five(['进清真寺', 'Ҳангоми даромадан ба масҷид', 'Входя в мечеть', 'Masjidga kirganda', 'Мечитке киргенде']),
  mean=five(['主啊，求你为我打开你的慈恩之门。', 'Худоё, дарҳои раҳмататро барои ман кушо.', 'О Аллах, открой для меня врата Твоей милости.', 'Allohim, menga rahmating eshiklarini och.', 'Аллахым, мага ырайымыңдын эшиктерин ач.']),
  src=src(('m', 713))),
 dict(id='mosqueOut', cat='mosque', ar=cut(muslim(713, 'افتح'), 'اللهم إني أسألك', 'من فضلك'), tr='Allāhumma innī asʾaluka min faḍlik', trc=dict(tg='Аллоҳумма иннӣ асъалука мин фазлик', ru='Аллахумма инни асъалюка мин фадлик', uz='Allohumma inniy asʼaluka min fazlik'),
  title=five(['出清真寺', 'Ҳангоми баромадан аз масҷид', 'Выходя из мечети', 'Masjiddan chiqqanda', 'Мечиттен чыкканда']),
  mean=five(['主啊，我向你祈求你的恩惠。', 'Худоё, аз фазли Ту мепурсам.', 'О Аллах, прошу у Тебя Твоей щедрости.', 'Allohim, Sendan fazlingni soʻrayman.', 'Аллахым, Сенден ырайымыңды сурайм.']),
  src=src(('m', 713))),
 dict(id='rain', cat='weather', ar=cut(B(1032), 'صيبا', 'نافعا'), tr='Ṣayyiban nāfiʿā', trc=dict(tg='Саййибан нофиъо', ru='Саййибан нафиъа', uz='Sayyiban nofiʼa'),
  title=five(['下雨时', 'Ҳангоми борон', 'Когда идёт дождь', 'Yomgʻir yoqqanda', 'Жамгыр жааганда']),
  mean=five(['（求你降下）有益的雨。', '(Худоё, бифирист) борони фоиданок.', '(О Аллах, ниспошли) полезный дождь.', '(Allohim,) foydali yomgʻir (yogʻdir).', '(Аллахым,) пайдалуу жамгыр (жаадыр).']),
  src=src(('b', 1032))),
 dict(id='wind', cat='weather', ar=cut(muslim(899, 'خيرها'), 'اللهم إني أسألك خيرها', 'ما أرسلت به وأعوذ بك من شرها وشر ما فيها وشر ما أرسلت به'),
  tr='Allāhumma innī asʾaluka khayrahā wa khayra mā fīhā wa khayra mā ursilat bih, wa aʿūdhu bika min sharrihā wa sharri mā fīhā wa sharri mā ursilat bih',
  trc=dict(tg='Аллоҳумма иннӣ асъалука хайраҳо ва хайра мо фиҳо ва хайра мо урсилат биҳ, ва аъузу бика мин шарриҳо ва шарри мо фиҳо ва шарри мо урсилат биҳ', ru='Аллахумма инни асъалюка хайраха ва хайра ма фиха ва хайра ма урсилят бих, ва аъузу бика мин шарриха ва шарри ма фиха ва шарри ма урсилят бих', uz='Allohumma inniy asʼaluka xayraho va xayra mo fiho va xayra mo ursilat bih, va aʼuzu bika min sharriho va sharri mo fiho va sharri mo ursilat bih'),
  title=five(['刮大风时', 'Ҳангоми боди сахт', 'При сильном ветре', 'Kuchli shamolda', 'Катуу шамалда']),
  mean=five(['主啊，我向你求这风的好处、风里带来的好处、它被派来带来的好处；求你护佑我免遭它的坏处、风里的坏处、它被派来带来的坏处。', 'Худоё, аз Ту хайри ин бод, хайри он чи дар он аст ва хайри он чи бо он фиристода шудааст, мехоҳам; ва аз шарри он, шарри он чи дар он аст ва шарри он чи бо он фиристода шудааст, ба Ту паноҳ мебарам.', 'О Аллах, прошу у Тебя блага этого ветра, блага того, что в нём, и блага того, с чем он послан; и прибегаю к Тебе от его зла, зла того, что в нём, и зла того, с чем он послан.', 'Allohim, Sendan bu shamolning yaxshiligini, undagi yaxshilikni va u bilan yuborilgan yaxshilikni soʻrayman; uning yomonligidan, undagi yomonlikdan va u bilan yuborilgan yomonlikdan Senga panoh tilayman.', 'Аллахым, Сенден бул шамалдын жакшылыгын, андагы жакшылыкты жана аны менен жиберилген жакшылыкты сурайм; анын жамандыгынан, андагы жамандыктан жана аны менен жиберилген жамандыктан Сага сыйынам.']),
  src=src(('m', 899))),
 dict(id='travel', cat='travel', ar=cut(muslim(1342, 'سخر'), 'سبحان الذي سخر', 'لمنقلبون'), tr='Subḥānal-ladhī sakhkhara lanā hādhā wa mā kunnā lahu muqrinīn, wa innā ilā rabbinā lamunqalibūn',
  trc=dict(tg='Субҳоналлазӣ саххара лано ҳозо ва мо кунно лаҳу муқринин, ва инно ило раббино ламунқалибун', ru='Субханаль-лязи саххара ляна хаза ва ма кунна ляху мукринин, ва инна иля раббина лямункалибун', uz='Subhonallaziy saxxara lano hazo va mo kunno lahu muqriniyn, va inno ilo robbino lamunqalibun'),
  title=five(['坐车出远门', 'Ҳангоми ба сафар баромадан', 'Отправляясь в путь', 'Safarga chiqqanda', 'Сапарга чыкканда']),
  mean=five(['赞颂真主超绝万物，他为我们制服了这个（坐骑），我们本来不能驾驭它；我们必定回到我们的主那里。', 'Пок аст Он ки инро барои мо мусаххар кард, дар ҳоле ки мо қодир ба он набудем; ва мо ба сӯи Парвардигорамон бозмегардем.', 'Пречист Тот, Кто подчинил нам это, ведь мы не смогли бы сделать это сами; и мы вернёмся к нашему Господу.', 'Buni bizga boʻysundirib qoʻygan Zot pokdir, biz bunga qodir emas edik; va albatta Robbimizga qaytguvchimiz.', 'Муну бизге баш ийдирген Зат аруу, биз буга күчүбүз жетпейт эле; жана биз сөзсүз Раббибизге кайтабыз.']),
  src=src(('m', 1342))),
 dict(id='sneeze', cat='people', ar=cut(B(6224), 'فليقل الحمد لله', 'الحمد لله').replace('فَلْيَقُلِ ', '').replace('فَلْيَقُلْ ', ''), tr='Al-ḥamdu lillāh', trc=dict(tg='Алҳамду лиллоҳ', ru='Альхамду лиллях', uz='Alhamdu lilloh'),
  title=five(['打喷嚏的人说', 'Атсазананда мегӯяд', 'Чихнувший говорит', 'Aksirgan kishi aytadi', 'Чүчкүргөн киши айтат']),
  mean=five(['一切赞颂全归真主。', 'Ҳамду сано Аллоҳро.', 'Хвала Аллаху.', 'Allohga hamd boʻlsin.', 'Аллахка мактоо болсун.']),
  src=src(('b', 6224))),
 dict(id='sneezeReply', cat='people', ar=cut(B(6224), 'يرحمك الله', 'يرحمك الله'), tr='Yarḥamukallāh', trc=dict(tg='Ярҳамукаллоҳ', ru='Ярхамукя-Ллах', uz='Yarhamukalloh'),
  title=five(['听见的人回答', 'Шунаванда ҷавоб медиҳад', 'Слышавший отвечает', 'Eshitgan kishi javob beradi', 'Уккан киши жооп берет']),
  mean=five(['愿真主怜悯你。', 'Аллоҳ бар ту раҳм кунад.', 'Да помилует тебя Аллах.', 'Alloh senga rahm qilsin.', 'Аллах сага ырайым кылсын.']),
  src=src(('b', 6224))),
 dict(id='sneezeBack', cat='people', ar=cut(B(6224), 'يهديكم الله', 'بالكم'), tr='Yahdīkumullāhu wa yuṣliḥu bālakum', trc=dict(tg='Яҳдикумуллоҳу ва юслиҳу болакум', ru='Яхдикумуллаху ва юслиху балякум', uz='Yahdiykumullohu va yuslihu bolakum'),
  title=five(['打喷嚏的人再回答', 'Атсазананда боз мегӯяд', 'Чихнувший отвечает', 'Aksirgan kishi yana aytadi', 'Чүчкүргөн киши кайра айтат']),
  mean=five(['愿真主引导你们，改善你们的情况。', 'Аллоҳ шуморо ҳидоят кунад ва ҳолатонро нек гардонад.', 'Да наставит вас Аллах и улучшит ваше положение.', 'Alloh sizlarni hidoyat qilsin va holingizni isloh qilsin.', 'Аллах силерди туура жолго салсын жана абалыңарды оңдосун.']),
  src=src(('b', 6224))),
 dict(id='visitSick', cat='people', ar=cut(B(3616), 'لا بأس طهور', 'إن شاء الله'), tr='Lā baʾsa ṭahūrun in shāʾallāh', trc=dict(tg='Ло баъса таҳурун иншоаллоҳ', ru='Ля ба-са тахурун ин ша-Аллах', uz='Lo baʼsa tahurun inshaalloh'),
  title=five(['探望病人', 'Ҳангоми аёдати бемор', 'Навещая больного', 'Bemorni koʻrgani borganda', 'Оорулууну көргөнү барганда']),
  mean=five(['不要紧，这是洗净（罪过），如果真主意欲。', 'Ҳеҷ гап не, ин покшавӣ (аз гуноҳ) аст, иншоаллоҳ.', 'Ничего страшного, это очищение (от грехов), если пожелает Аллах.', 'Hechqisi yoʻq, bu (gunohlardan) poklanish, inshaalloh.', 'Эч нерсе эмес, бул (күнөөлөрдөн) тазалануу, иншаллах.']),
  src=src(('b', 3616))),
 dict(id='distress', cat='heart', ar=cut(B(6346), 'لا إله إلا الله العظيم', 'العرش الكريم'),
  tr='Lā ilāha illallāhul-ʿAẓīmul-Ḥalīm, lā ilāha illallāhu rabbul-ʿarshil-ʿaẓīm, lā ilāha illallāhu rabbus-samāwāti wa rabbul-arḍi wa rabbul-ʿarshil-karīm',
  trc=dict(tg='Ло илоҳа иллаллоҳул-ъазимул-ҳалим, ло илоҳа иллаллоҳу раббул-ъаршил-ъазим, ло илоҳа иллаллоҳу раббус-самовоти ва раббул-арзи ва раббул-ъаршил-карим', ru='Ля иляха илля-Ллаху-ль-Азыму-ль-Халим, ля иляха илля-Ллаху раббу-ль-арши-ль-азым, ля иляха илля-Ллаху раббу-с-самавати ва раббу-ль-арди ва раббу-ль-арши-ль-карим', uz='Lo ilaha illallohul-ʼaziymul-haliym, lo ilaha illallohu robbul-ʼarshil-ʼaziym, lo ilaha illallohu robbus-samovati va robbul-arzi va robbul-ʼarshil-kariym'),
  title=five(['心里苦闷、遇到难处', 'Ҳангоми ғам ва душворӣ', 'В горе и трудности', 'Gʻam va qiyinchilikda', 'Кайгы жана кыйынчылыкта']),
  mean=five(['除伟大、宽容的真主外，绝无应受崇拜的；除真主——伟大宝座的主外，绝无应受崇拜的；除真主——诸天的主、大地的主、尊贵宝座的主外，绝无应受崇拜的。', 'Нест маъбуде ҷуз Аллоҳи бузурги бурдбор; нест маъбуде ҷуз Аллоҳ, Парвардигори Арши бузург; нест маъбуде ҷуз Аллоҳ, Парвардигори осмонҳо, Парвардигори замин ва Парвардигори Арши гиромӣ.', 'Нет божества, кроме Аллаха, Великого, Кроткого; нет божества, кроме Аллаха, Господа великого Трона; нет божества, кроме Аллаха, Господа небес, Господа земли и Господа благородного Трона.', 'Buyuk va halim Allohdan oʻzga iloh yoʻq; buyuk Arshning Robbi Allohdan oʻzga iloh yoʻq; osmonlarning Robbi, yerning Robbi va karamli Arshning Robbi Allohdan oʻzga iloh yoʻq.', 'Улуу, сабырдуу Аллахтан башка кудай жок; улуу Арштын Рабби Аллахтан башка кудай жок; асмандардын Рабби, жердин Рабби жана урматтуу Арштын Рабби Аллахтан башка кудай жок.']),
  src=src(('b', 6346))),
 dict(id='anger', cat='heart', ar=cut(B(3282), 'أعوذ بالله من الشيطان', 'من الشيطان'), tr='Aʿūdhu billāhi minash-shayṭān', trc=dict(tg='Аъузу биллоҳи минаш-шайтон', ru='Аъузу би-Лляхи мина-ш-шайтан', uz='Aʼuzu billahi minash-shayton'),
  title=five(['生气时', 'Ҳангоми хашм', 'В гневе', 'Gʻazablanganda', 'Ачууланганда']),
  mean=five(['我求真主护佑，免遭恶魔之害。', 'Аз шайтон ба Аллоҳ паноҳ мебарам.', 'Прибегаю к Аллаху от шайтана.', 'Shaytondan Allohga panoh tilayman.', 'Шайтандан Аллахка сыйынам.']),
  src=src(('b', 3282))),
 dict(id='calamity', cat='heart', ar=cut(muslim(918, 'راجعون'), 'إنا لله وإنا إليه راجعون', 'خيرا منها'),
  tr='Innā lillāhi wa innā ilayhi rājiʿūn, Allāhumma ʾjurnī fī muṣībatī wa akhlif lī khayran minhā',
  trc=dict(tg='Инно лиллоҳи ва инно илайҳи роҷиъун, Аллоҳумма-ҷурнӣ фӣ мусибатӣ ва ахлиф лӣ хайран минҳо', ru='Инна лилляхи ва инна иляйхи раджиун, Аллахумма-джурни фи мусыбати ва ахлиф ли хайран минха', uz='Inno lillahi va inno ilayhi rojiʼun, Allohumma-jurniy fiy musiybatiy va axlif liy xayran minho'),
  title=five(['遇到不幸', 'Ҳангоми мусибат', 'При беде', 'Musibat yetganda', 'Кырсык болгондо']),
  mean=five(['我们确是真主的，我们必定回到他那里。主啊，求你在我的不幸中报偿我，并赐我比它更好的。', 'Мо аз они Аллоҳем ва ба сӯи Ӯ бозмегардем. Худоё, дар мусибатам ба ман аҷр деҳ ва беҳтар аз онро ба ман ҷойгузин кун.', 'Поистине, мы принадлежим Аллаху и к Нему вернёмся. О Аллах, вознагради меня в моей беде и дай мне взамен лучшее.', 'Albatta, biz Allohnikimiz va albatta Unga qaytamiz. Allohim, musibatimda menga ajr ber va oʻrniga undan yaxshirogʻini ber.', 'Албетте, биз Аллахтыкыбыз жана Ага кайтабыз. Аллахым, кырсыгымда мага сооп бер жана ордуна андан жакшысын бер.']),
  src=src(('m', 918))),
 dict(id='iftar', cat='fast', ar=cut(AD(2357), 'ذهب الظمأ', 'إن شاء الله'), tr='Dhahabaẓ-ẓamaʾu wabtallatil-ʿurūqu wa thabatal-ajru in shāʾallāh',
  trc=dict(tg='Заҳабаз-замаъу вабталлатил-ъуруқу ва собатал-аҷру иншоаллоҳ', ru='Захаба-з-замаъу ва-бталляти-ль-урук ва сабата-ль-аджру ин ша-Аллах', uz='Zahabaz-zamaʼu vabtallatil-ʼuruqu va sabatal-ajru inshaalloh'),
  title=five(['开斋时', 'Ҳангоми ифтор', 'При разговении', 'Iftor qilganda', 'Ооз ачканда']),
  mean=five(['口渴消了，血脉润了，报酬定了，如果真主意欲。', 'Ташнагӣ рафт, рагҳо тар шуданд ва савоб собит гашт, иншоаллоҳ.', 'Ушла жажда, увлажнились жилы, и утвердилась награда, если пожелает Аллах.', 'Chanqoq ketdi, tomirlar namlandi va ajr sobit boʻldi, inshaalloh.', 'Суусоо кетти, тамырлар нымдалды жана сооп бекиди, иншаллах.']),
  src=src(('d', 2357))),
]
CATS = ['food', 'home', 'sleep', 'clean', 'mosque', 'weather', 'travel', 'people', 'heart', 'fast']
for x in ITEMS:
    assert x['cat'] in CATS
    for k in ('title', 'mean', 'src'): assert set(x[k]) == set(L), (x['id'], k)
    assert not re.search(r'[A-Za-z]', ''.join(x['ar'])), x['id']
with open(OUT, 'w') as f:
    f.write('// 自动生成：scripts/data/build-duas.py。阿拉伯文从圣训原文逐字截取（截不到就报错），出处是标准编号。\n')
    f.write('// 译音、意思五种语言（塔吉克语、俄语、乌兹别克语、吉尔吉斯语为初稿，待母语者和伊玛目审定）。\n')
    f.write('export const DUA_CATS = ' + json.dumps(CATS) + ';\n')
    f.write('export const DUAS = ' + json.dumps(ITEMS, ensure_ascii=False) + ';\n')
print(len(ITEMS), 'duas')
for x in ITEMS: print(x['id'], x['ar'])
