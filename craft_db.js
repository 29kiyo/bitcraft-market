// ============================================
// 手動クラフトレシピDB
// ============================================
// k の種類:
//   tool       = Ingot×4 + Rope×2 + Plank×2 + Leather×2
//   weapon     = Ingot×5 + Rope×1 + Plank×1 + Leather×1
//   plated_ar  = Ingot×5 + Cloth×2
//   plated_be  = Ingot×3 + Cloth×1
//   plated_bo  = Ingot×2 + Cloth×1
//   plated_he  = Ingot×3 + Cloth×1
//   plated_br  = Ingot×1
//   plated_le  = Ingot×4 + Cloth×1
//   duelist_*  = Ingot×4 + Leather×2 + Cloth×1 + AncMetal×15
//   leather_*  = 各部位ごとに素材が異なる
//   woven_*    = 各部位ごとに素材が異なる
//   direct     = 素材を直接指定 {s:[{id,q}]}
// p = 前Tier素材のアイテムID
// t = Tier番号

// 手動レシピDB
// ============================================
const TIER_MATS = {
  1:{ingot:1050001,rope:1090004,plank:1020003,leather:1070004,cloth:1090002,strip:1464553255},
  2:{ingot:2050001,rope:2090004,plank:2020003,leather:2070004,cloth:2090002,strip:1537459864},
  3:{ingot:3050001,rope:3090004,plank:3020003,leather:3070004,cloth:3090002,strip:989485035},
  4:{ingot:4050001,rope:4090004,plank:4020003,leather:4070004,cloth:4090002,strip:1442354536},
  5:{ingot:5050001,rope:5090004,plank:5020003,leather:5070004,cloth:5090002,strip:1481097878},
  6:{ingot:6050001,rope:6090004,plank:6020003,leather:6070004,cloth:6090002,strip:487923809},
  7:{ingot:1899017490,rope:625147590,plank:1639308227,leather:806992520,cloth:1610800379,strip:2049788179},
  8:{ingot:1464752960,rope:1224328894,plank:28056473,leather:1743778001,cloth:136406464,strip:1568797710},
  9:{ingot:1979722091,rope:471802228,plank:1227914325,leather:1580025475,cloth:282660928,strip:2065775136},
  10:{ingot:2069757207,rope:547017087,plank:117329467,leather:711364475,cloth:35270576,strip:1836205414},
};
const ANC_METAL = 1718148009;

// k: 'tool'=Ingot×4+Rope×2+Plank×2+Leather×2, 'plated'=Ingot×5+Cloth×2
//    'duelist'=Ingot×4+Leather×2+Cloth×1+AncMetal×15, 'prev'=前Tierのみ
//    'direct'=素材を直接指定
const CRAFT_DB = {
  // ツール・武器 T2-T6
'Pyrelite Axe':{p:1201067083,t:2,k:'tool'},'Pyrelite Bow':{p:2054875237,t:2,k:'tool'},
'Pyrelite Chisel':{p:1831352039,t:2,k:'tool'},'Pyrelite Claymore':{p:252729537,t:2,k:'weapon'},
'Pyrelite Crossbow':{p:1471860856,t:2,k:'weapon'},'Pyrelite Daggers':{p:747689943,t:2,k:'weapon'},
'Pyrelite Hammer':{p:1669114499,t:2,k:'tool'},'Pyrelite Hoe':{p:273473901,t:2,k:'tool'},
'Pyrelite Knife':{p:1503159114,t:2,k:'tool'},'Pyrelite Mace':{p:1823909616,t:2,k:'weapon'},
'Pyrelite Machete':{p:571682698,t:2,k:'tool'},'Pyrelite Pickaxe':{p:1704711141,t:2,k:'tool'},
'Pyrelite Quill':{p:530006562,t:2,k:'tool'},'Pyrelite Rod':{p:544541723,t:2,k:'tool'},
'Pyrelite Saw':{p:1355330989,t:2,k:'tool'},'Pyrelite Scissors':{p:1125962328,t:2,k:'tool'},
'Pyrelite Shortsword':{p:194332661,t:2,k:'weapon'},'Pyrelite Spear & Shield':{p:1826240904,t:2,k:'weapon'},

'Emarium Axe':{p:1605904571,t:3,k:'tool'},'Emarium Bow':{p:1034184552,t:3,k:'tool'},
'Emarium Chisel':{p:1413938165,t:3,k:'tool'},'Emarium Claymore':{p:620508449,t:3,k:'weapon'},
'Emarium Crossbow':{p:1512593047,t:3,k:'weapon'},'Emarium Daggers':{p:465856554,t:3,k:'weapon'},
'Emarium Hammer':{p:482196569,t:3,k:'tool'},'Emarium Hoe':{p:1644135836,t:3,k:'tool'},
'Emarium Knife':{p:1316428000,t:3,k:'tool'},'Emarium Mace':{p:1598024081,t:3,k:'weapon'},
'Emarium Machete':{p:223757569,t:3,k:'tool'},'Emarium Pickaxe':{p:513104323,t:3,k:'tool'},
'Emarium Quill':{p:414853205,t:3,k:'tool'},'Emarium Rod':{p:843645212,t:3,k:'tool'},
'Emarium Saw':{p:412214433,t:3,k:'tool'},'Emarium Scissors':{p:343569714,t:3,k:'tool'},
'Emarium Shortsword':{p:333188935,t:3,k:'weapon'},'Emarium Spear & Shield':{p:2098377887,t:3,k:'weapon'},

'Elenvar Axe':{p:1486054968,t:4,k:'tool'},'Elenvar Bow':{p:1219038577,t:4,k:'tool'},
'Elenvar Chisel':{p:438003010,t:4,k:'tool'},'Elenvar Claymore':{p:480170023,t:4,k:'weapon'},
'Elenvar Crossbow':{p:1176798477,t:4,k:'weapon'},'Elenvar Daggers':{p:412987444,t:4,k:'weapon'},
'Elenvar Hammer':{p:398791964,t:4,k:'tool'},'Elenvar Hoe':{p:1043267104,t:4,k:'tool'},
'Elenvar Knife':{p:971385983,t:4,k:'tool'},'Elenvar Mace':{p:1145327846,t:4,k:'weapon'},
'Elenvar Machete':{p:1229547048,t:4,k:'tool'},'Elenvar Pickaxe':{p:2124079079,t:4,k:'tool'},
'Elenvar Quill':{p:1221634026,t:4,k:'tool'},'Elenvar Rod':{p:1094163061,t:4,k:'tool'},
'Elenvar Saw':{p:1930789220,t:4,k:'tool'},'Elenvar Scissors':{p:803429716,t:4,k:'tool'},
'Elenvar Spear & Shield':{p:1888091519,t:4,k:'weapon'},'Elenvar Shortsword':{p:1143890441,t:4,k:'weapon'},

'Luminite Axe':{p:489724302,t:5,k:'tool'},'Luminite Bow':{p:735626470,t:5,k:'tool'},
'Luminite Chisel':{p:2122350182,t:5,k:'tool'},'Luminite Claymore':{p:1800349844,t:5,k:'weapon'},
'Luminite Crossbow':{p:1184634453,t:5,k:'weapon'},'Luminite Daggers':{p:1800053684,t:5,k:'weapon'},
'Luminite Hammer':{p:382339978,t:5,k:'tool'},'Luminite Hoe':{p:1891681591,t:5,k:'tool'},
'Luminite Knife':{p:268156651,t:5,k:'tool'},'Luminite Machete':{p:1342482833,t:5,k:'tool'},
'Luminite Pickaxe':{p:2015514055,t:5,k:'tool'},'Luminite Quill':{p:139776334,t:5,k:'tool'},
'Luminite Rod':{p:1858500155,t:5,k:'tool'},'Luminite Saw':{p:1115966209,t:5,k:'tool'},
'Luminite Scissors':{p:582320225,t:5,k:'tool'},'Luminite Spear & Shield':{p:1800572877,t:5,k:'weapon'},
'Luminite Mace':{p:1841497848,t:5,k:'weapon'},'Luminite Shortsword':{p:988443947,t:5,k:'weapon'},

'Rathium Chisel':{p:1771114282,t:6,k:'tool'},'Rathium Scissors':{p:783907612,t:6,k:'tool'},
"Rathium Axe":{p:'724409328',t:5,k:'tool'},"Rathium Bow":{p:'1300016557',t:5,k:'tool'},
"Rathium Claymore":{p:'580810311',t:5,k:'weapon'},"Rathium Crossbow":{p:'673207772',t:5,k:'weapon'},
"Rathium Daggers":{p:'2126197692',t:5,k:'weapon'},"Rathium Hammer":{p:'851522677',t:5,k:'tool'},
"Rathium Hoe":{p:'615404092',t:5,k:'tool'},"Rathium Knife":{p:'48557171',t:5,k:'tool'},
"Rathium Mace":{p:'637858677',t:5,k:'weapon'},"Rathium Machete":{p:'1536392855',t:5,k:'tool'},
"Rathium Pickaxe":{p:'496053871',t:5,k:'tool'},"Rathium Quill":{p:'191522893',t:5,k:'tool'},
"Rathium Rod":{p:'1758200750',t:5,k:'tool'},"Rathium Saw":{p:'404233507',t:5,k:'tool'},
"Rathium Shortsword":{p:'144598614',t:5,k:'weapon'},"Rathium Spear & Shield":{p:'554291192',t:5,k:'weapon'},
  // T7-T10 ツール・武器
'Aurumite Axe':{p:1553464985,t:7,k:'tool'},'Aurumite Bow':{p:1491113278,t:7,k:'tool'},
'Aurumite Chisel':{p:1428413909,t:7,k:'tool'},'Aurumite Claymore':{p:977876862,t:7,k:'weapon'},
'Aurumite Crossbow':{p:2031755509,t:7,k:'weapon'},'Aurumite Daggers':{p:1308904989,t:7,k:'weapon'},
'Aurumite Hammer':{p:353834323,t:7,k:'tool'},'Aurumite Hoe':{p:1821220821,t:7,k:'tool'},
'Aurumite Knife':{p:270820549,t:7,k:'tool'},'Aurumite Mace':{p:1134539652,t:7,k:'weapon'},
'Aurumite Machete':{p:1941748536,t:7,k:'tool'},'Aurumite Pickaxe':{p:1019977008,t:7,k:'tool'},
'Aurumite Quill':{p:1039518462,t:7,k:'tool'},'Aurumite Rod':{p:1677637105,t:7,k:'tool'},
'Aurumite Saw':{p:1753110534,t:7,k:'tool'},'Aurumite Scissors':{p:1828085396,t:7,k:'tool'},
'Aurumite Shortsword':{p:1704320467,t:7,k:'weapon'},'Aurumite Spear & Shield':{p:1428680361,t:7,k:'weapon'},

'Celestium Axe':{p:1337511485,t:8,k:'tool'},'Celestium Bow':{p:1144166893,t:8,k:'tool'},
'Celestium Chisel':{p:789795936,t:8,k:'tool'},'Celestium Claymore':{p:1814060816,t:8,k:'weapon'},
'Celestium Crossbow':{p:1341361216,t:8,k:'weapon'},'Celestium Daggers':{p:1002395423,t:8,k:'weapon'},
'Celestium Hammer':{p:1047843413,t:8,k:'tool'},'Celestium Hoe':{p:110205879,t:8,k:'tool'},
'Celestium Knife':{p:178238273,t:8,k:'tool'},'Celestium Mace':{p:1710015327,t:8,k:'weapon'},
'Celestium Machete':{p:728445804,t:8,k:'tool'},'Celestium Pickaxe':{p:1926302459,t:8,k:'tool'},
'Celestium Quill':{p:1165036582,t:8,k:'tool'},'Celestium Rod':{p:1406728773,t:8,k:'tool'},
'Celestium Saw':{p:1176061468,t:8,k:'tool'},'Celestium Scissors':{p:1700689396,t:8,k:'tool'},
'Celestium Shortsword':{p:502541107,t:8,k:'weapon'},'Celestium Spear & Shield':{p:1641524052,t:8,k:'weapon'},

'Umbracite Axe':{p:1967177382,t:9,k:'tool'},'Umbracite Bow':{p:1255416131,t:9,k:'tool'},
'Umbracite Chisel':{p:247800929,t:9,k:'tool'},'Umbracite Claymore':{p:1242957888,t:9,k:'weapon'},
'Umbracite Crossbow':{p:176089093,t:9,k:'weapon'},'Umbracite Daggers':{p:2118322388,t:9,k:'weapon'},
'Umbracite Hammer':{p:1925316516,t:9,k:'tool'},'Umbracite Hoe':{p:1393188394,t:9,k:'tool'},
'Umbracite Knife':{p:1297341889,t:9,k:'tool'},'Umbracite Mace':{p:1999151730,t:9,k:'weapon'},
'Umbracite Machete':{p:568446581,t:9,k:'tool'},'Umbracite Pickaxe':{p:1840720045,t:9,k:'tool'},
'Umbracite Quill':{p:1384947495,t:9,k:'tool'},'Umbracite Rod':{p:1285380429,t:9,k:'tool'},
'Umbracite Saw':{p:2138097685,t:9,k:'tool'},'Umbracite Scissors':{p:598915758,t:9,k:'tool'},
'Umbracite Shortsword':{p:1214952757,t:9,k:'weapon'},'Umbracite Spear & Shield':{p:1176526661,t:9,k:'weapon'},

'Astralite Axe':{p:1845657486,t:10,k:'tool'},'Astralite Bow':{p:1508575560,t:10,k:'tool'},
'Astralite Chisel':{p:1469116327,t:10,k:'tool'},'Astralite Claymore':{p:450178430,t:10,k:'weapon'},
'Astralite Crossbow':{p:1408136102,t:10,k:'weapon'},'Astralite Daggers':{p:1792766140,t:10,k:'weapon'},
'Astralite Hammer':{p:318446982,t:10,k:'tool'},'Astralite Hoe':{p:2109745066,t:10,k:'tool'},
'Astralite Knife':{p:1260356897,t:10,k:'tool'},'Astralite Mace':{p:1744196359,t:10,k:'weapon'},
'Astralite Machete':{p:527234707,t:10,k:'tool'},'Astralite Pickaxe':{p:909366533,t:10,k:'tool'},
'Astralite Quill':{p:237861696,t:10,k:'tool'},'Astralite Rod':{p:150640331,t:10,k:'tool'},
'Astralite Saw':{p:108221358,t:10,k:'tool'},'Astralite Scissors':{p:1184202153,t:10,k:'tool'},
'Astralite Shortsword':{p:1820283901,t:10,k:'weapon'},'Astralite Spear & Shield':{p:1252434161,t:10,k:'weapon'},

  // Plated T2-T6
'Pyrelite Plated Armor':{p:422440070,t:2,k:'plated_ar'},'Pyrelite Plated Belt':{p:922569705,t:2,k:'plated_be'},
'Pyrelite Plated Boots':{p:155776141,t:2,k:'plated_bo'},'Pyrelite Plated Helm':{p:1919532147,t:2,k:'plated_he'},
'Pyrelite Plated Bracers':{p:87535478,t:2,k:'plated_br'},'Pyrelite Plated Legguards':{p:826048995,t:2,k:'plated_le'},

'Emarium Plated Armor':{p:1268204743,t:3,k:'plated_ar'},'Emarium Plated Belt':{p:1682637898,t:3,k:'plated_be'},
'Emarium Plated Boots':{p:763048785,t:3,k:'plated_bo'},'Emarium Plated Helm':{p:2077008468,t:3,k:'plated_he'},
'Emarium Plated Bracers':{p:292570178,t:3,k:'plated_br'},'Emarium Plated Legguards':{p:1103185737,t:3,k:'plated_le'},

'Elenvar Plated Armor':{p:543757315,t:4,k:'plated_ar'},'Elenvar Plated Belt':{p:2093870307,t:4,k:'plated_be'},
'Elenvar Plated Boots':{p:1871358332,t:4,k:'plated_bo'},'Elenvar Plated Helm':{p:1382820561,t:4,k:'plated_he'},
'Elenvar Plated Bracers':{p:2057075881,t:4,k:'plated_br'},'Elenvar Plated Legguards':{p:1467877529,t:4,k:'plated_le'},

'Luminite Plated Armor':{p:1614334993,t:5,k:'plated_ar'},'Luminite Plated Belt':{p:803904452,t:5,k:'plated_be'},
'Luminite Plated Boots':{p:1205236443,t:5,k:'plated_bo'},'Luminite Plated Helm':{p:525926772,t:5,k:'plated_he'},
'Luminite Plated Bracers':{p:1284279632,t:5,k:'plated_br'},'Luminite Plated Legguards':{p:754775218,t:5,k:'plated_le'},

'Rathium Plated Armor':{p:1793408922,t:6,k:'plated_ar'},'Rathium Plated Belt':{p:1896878792,t:6,k:'plated_be'},
'Rathium Plated Boots':{p:1423216650,t:6,k:'plated_bo'},'Rathium Plated Helm':{p:1115040228,t:6,k:'plated_he'},
'Rathium Plated Bracers':{p:1555011340,t:6,k:'plated_br'},'Rathium Plated Legguards':{p:1426381959,t:6,k:'plated_le'},
  // Plated T7-T10 
'Aurumite Plated Armor':{p:1288616853,t:7,k:'plated_ar'},'Aurumite Plated Belt':{p:136895150,t:7,k:'plated_be'},
'Aurumite Plated Boots':{p:1766218099,t:7,k:'plated_bo'},'Aurumite Plated Helm':{p:1168955390,t:7,k:'plated_he'},
'Aurumite Plated Bracers':{p:2092460854,t:7,k:'plated_br'},'Aurumite Plated Legguards':{p:1402365193,t:7,k:'plated_le'},

'Celestium Plated Armor':{p:1539382157,t:8,k:'plated_ar'},'Celestium Plated Belt':{p:85682890,t:8,k:'plated_be'},
'Celestium Plated Boots':{p:937990529,t:8,k:'plated_bo'},'Celestium Plated Helm':{p:1578036637,t:8,k:'plated_he'},
'Celestium Plated Bracers':{p:2092460854,t:8,k:'plated_br'},'Celestium Plated Legguards':{p:706040362,t:8,k:'plated_le'},

'Umbracite Plated Armor':{p:1206079882,t:9,k:'plated_ar'},'Umbracite Plated Belt':{p:1342061977,t:9,k:'plated_be'},
'Umbracite Plated Boots':{p:33263838,t:9,k:'plated_bo'},'Umbracite Plated Helm':{p:999002692,t:9,k:'plated_he'},
'Umbracite Plated Bracers':{p:1481337975,t:9,k:'plated_br'},'Umbracite Plated Legguards':{p:1143633588,t:9,k:'plated_le'},

'Astralite Plated Armor':{p:676999714,t:10,k:'plated_ar'},'Astralite Plated Belt':{p:1134288202,t:10,k:'plated_be'},
'Astralite Plated Boots':{p:451224316,t:10,k:'plated_bo'},'Astralite Plated Helm':{p:394704078,t:10,k:'plated_he'},
'Astralite Plated Bracers':{p:675288287,t:10,k:'plated_br'},'Astralite Plated Legguards':{p:2092181285,t:10,k:'plated_le'},
  // Duelist T2-T6 
'Pyrelite Duelist Armor':{p:1554355057,t:2,k:'duelist_ar'},'Pyrelite Duelist Belt':{p:288183013,t:2,k:'duelist_be'},
'Pyrelite Duelist Boots':{p:664595734,t:2,k:'duelist_bo'},'Pyrelite Duelist Helm':{p:152653749,t:2,k:'duelist_he'},
'Pyrelite Duelist Bracers':{p:2044169478,t:2,k:'duelist_br'},'Pyrelite Duelist Legguards':{p:1918416442,t:2,k:'duelist_le'},

'Emarium Duelist Armor':{p:712055376,t:3,k:'duelist_ar'},'Emarium Duelist Belt':{p:1654952717,t:3,k:'duelist_be'},
'Emarium Duelist Boots':{p:1792280603,t:3,k:'duelist_bo'},'Emarium Duelist Helm':{p:1779898711,t:3,k:'duelist_he'},
'Emarium Duelist Bracers':{p:1409596491,t:3,k:'duelist_br'},'Emarium Duelist Legguards':{p:1867856730,t:3,k:'duelist_le'},

'Elenvar Duelist Armor':{p:1302571061,t:4,k:'duelist_ar'},'Elenvar Duelist Belt':{p:420782305,t:4,k:'duelist_be'},
'Elenvar Duelist Boots':{p:1883555938,t:4,k:'duelist_bo'},'Elenvar Duelist Helm':{p:947997324,t:4,k:'duelist_he'},
'Elenvar Duelist Bracers':{p:650219251,t:4,k:'duelist_br'},'Elenvar Duelist Legguards':{p:477821530,t:4,k:'duelist_le'},

'Luminite Duelist Armor':{p:1381073895,t:5,k:'duelist_ar'},'Luminite Duelist Belt':{p:2047631399,t:5,k:'duelist_be'},
'Luminite Duelist Boots':{p:134007121,t:5,k:'duelist_bo'},'Luminite Duelist Helm':{p:941973321,t:5,k:'duelist_he'},
'Luminite Duelist Bracers':{p:274271761,t:5,k:'duelist_br'},'Luminite Duelist Legguards':{p:209639785,t:5,k:'duelist_le'},

'Rathium Duelist Armor':{p:2139660051,t:6,k:'duelist_ar'},'Rathium Duelist Belt':{p:247907334,t:6,k:'duelist_be'},
'Rathium Duelist Boots':{p:62198748,t:6,k:'duelist_bo'},'Rathium Duelist Helm':{p:262655142,t:6,k:'duelist_he'},
'Rathium Duelist Bracers':{p:406791749,t:6,k:'duelist_br'},'Rathium Duelist Legguards':{p:1927576181,t:6,k:'duelist_le'},
  
  // Duelist T7-T10
'Aurumite Duelist Armor':{p:1759574046,t:7,k:'duelist_ar'},'Aurumite Duelist Belt':{p:1867643778,t:7,k:'duelist_be'},
'Aurumite Duelist Boots':{p:1113464036,t:7,k:'duelist_bo'},'Aurumite Duelist Bracers':{p:1371681362,t:7,k:'duelist_br'},
'Aurumite Duelist Helm':{p:1272659593,t:7,k:'duelist_he'},'Aurumite Duelist Legguards':{p:933553170,t:7,k:'duelist_le'},

'Celestium Duelist Armor':{p:1511926353,t:8,k:'duelist_ar'},'Celestium Duelist Belt':{p:663979557,t:8,k:'duelist_be'},
'Celestium Duelist Boots':{p:1596933905,t:8,k:'duelist_bo'},'Celestium Duelist Bracers':{p:835268734,t:8,k:'duelist_br'},
'Celestium Duelist Helm':{p:332321387,t:8,k:'duelist_he'},'Celestium Duelist Legguards':{p:952839179,t:8,k:'duelist_le'},

'Umbracite Duelist Armor':{p:1573634427,t:9,k:'duelist_ar'},'Umbracite Duelist Belt':{p:1333527025,t:9,k:'duelist_be'},
'Umbracite Duelist Boots':{p:479699131,t:9,k:'duelist_bo'},'Umbracite Duelist Bracers':{p:1622384894,t:9,k:'duelist_br'},
'Umbracite Duelist Helm':{p:2113725252,t:9,k:'duelist_he'},'Umbracite Duelist Legguards':{p:1236430591,t:9,k:'duelist_le'},

'Astralite Duelist Armor':{p:453964810,t:10,k:'duelist_ar'},'Astralite Duelist Belt':{p:663456834,t:10,k:'duelist_be'},
'Astralite Duelist Boots':{p:379236578,t:10,k:'duelist_bo'},'Astralite Duelist Bracers':{p:679524038,t:10,k:'duelist_br'},
'Astralite Duelist Helm':{p:638425412,t:10,k:'duelist_he'},'Astralite Duelist Legguards':{p:1758467540,t:10,k:'duelist_le'},

// 革装備 T2-T6
'simple leather belt':{p:1548924604,t:2,k:'leather_be'},'simple leather boots':{p:442339538,t:2,k:'leather_bo'},
'simple leather cap':{p:1437965200,t:2,k:'leather_ca'},'simple leather gloves':{p:471537919,t:2,k:'leather_gl'},
'simple leather Leggings':{p:1911943829,t:2,k:'leather_le'},'simple leather Shirt':{p:1911943829,t:2,k:'leather_sh'},

'sturdy leather belt':{p:1911943829,t:3,k:'leather_be'}, 'sturdy leather boots':{p:45851234,t:3,k:'leather_bo'},
'sturdy leather cap':{p:475668425,t:3,k:'leather_ca'}, 'sturdy leather gloves':{p:104188419,t:3,k:'leather_gl'},
'sturdy leather leggings':{p:1475691769,t:3,k:'leather_le'}, 'sturdy leather shirt':{p:767288477,t:3,k:'leather_sh'},

'fine leather belt':{p:267188619,t:4,k:'leather_be'}, 'fine leather boots':{p:687015665,t:4,k:'leather_bo'},
'fine leather cap':{p:2092519490,t:4,k:'leather_ca'}, 'fine leather gloves':{p:119486624,t:4,k:'leather_gl'},
'fine leather leggings':{p:1764915050,t:4,k:'leather_le'}, 'fine leather shirt':{p:1790099921,t:4,k:'leather_sh'},

'exquisite leather belt':{p:1148010649,t:5,k:'leather_be'}, 'exquisite leather boots':{p:1576306916,t:5,k:'leather_bo'},
'exquisite leather cap':{p:519083873,t:5,k:'leather_ca'}, 'exquisite leather gloves':{p:1388204483,t:5,k:'leather_gl'},
'exquisite leather leggings':{p:501062290,t:5,k:'leather_le'}, 'exquisite leather shirt':{p:975181088,t:5,k:'leather_sh'},

'peerless leather belt':{p:1738310260,t:6,k:'leather_be'}, 'peerless leather boots':{p:1600561783,t:6,k:'leather_bo'},
'peerless leather cap':{p:390309715,t:6,k:'leather_ca'}, 'peerless leather gloves':{p:248609097,t:6,k:'leather_gl'},
'peerless leather leggings':{p:1245381696,t:6,k:'leather_le'}, 'peerless leather shirt':{p:327065735,t:6,k:'leather_sh'},
//革装備 T7-T10
'ornate leather belt':{p:1639525324,t:7,k:'leather_be'}, 'ornate leather boots':{p:27075659,t:7,k:'leather_bo'},
'ornate leather cap':{p:1259363783,t:7,k:'leather_ca'}, 'ornate leather gloves':{p:411811927,t:7,k:'leather_gl'},
'ornate leather leggings':{p:1422988853,t:7,k:'leather_le'}, 'ornate leather shirt':{p:275250276,t:7,k:'leather_sh'},

'pristine leather belt':{p:1639525324,t:8,k:'leather_be'}, 'pristine leather boots':{p:27075659,t:8,k:'leather_bo'},
'pristine leather cap':{p:1259363783,t:8,k:'leather_ca'}, 'pristine leather gloves':{p:411811927,t:8,k:'leather_gl'},
'pristine leather leggings':{p:1422988853,t:8,k:'leather_le'}, 'pristine leather shirt':{p:275250276,t:8,k:'leather_sh'},

'magnificent leather belt':{p:1392853274,t:9,k:'leather_be'}, 'magnificent leather boots':{p:1027946022,t:9,k:'leather_bo'},
'magnificent leather cap':{p:1488876546,t:9,k:'leather_ca'}, 'magnificent leather gloves':{p:1474288184,t:9,k:'leather_gl'},
'magnificent leather leggings':{p:172806342,t:9,k:'leather_le'}, 'magnificent leather shirt':{p:60984074,t:9,k:'leather_sh'},

'flawless leather belt':{p:148416223,t:10,k:'leather_be'}, 'flawless leather shoes':{p:566693853,t:10,k:'leather_bo'},
'flawless leather cap':{p:371225209,t:10,k:'leather_ca'}, 'flawless leather gloves':{p:817248199,t:10,k:'leather_gl'},
'flawless leather leggings':{p:982285702,t:10,k:'leather_le'}, 'flawless leather shirt':{p:495020093,t:10,k:'leather_sh'},

//布装備 T2-T6
'simple woven belt':{p:922569704,t:2,k:'woven_be'},'simple woven shoes':{p:155776140,t:2,k:'woven_shoes'},
'simple woven cap':{p:1919532146,t:2,k:'woven_cap'},'simple woven gloves':{p:87535477,t:2,k:'woven_gloves'},
'simple woven shorts':{p:826048994,t:2,k:'woven_shorts'},'simple woven shirt':{p:422440069,t:2,k:'woven_shirt'},

'sturdy woven belt':{p:726338348,t:3,k:'woven_be'},'sturdy woven shoes':{p:346206325,t:3,k:'woven_shoes'},
'sturdy woven cap':{p:29896794,t:3,k:'woven_cap'},'sturdy woven gloves':{p:2020078588,t:3,k:'woven_gloves'},
'sturdy woven shorts':{p:543187335,t:3,k:'woven_shorts'},'sturdy woven shirt':{p:479534285,t:3,k:'woven_shirt'},

'fine woven belt':{p:83640847,t:4,k:'woven_be'},'fine woven shoes':{p:331949206,t:4,k:'woven_shoes'},
'fine woven cap':{p:162644991,t:4,k:'woven_cap'},'fine woven gloves':{p:259933928,t:4,k:'woven_gloves'},
'fine woven shorts':{p:1352602844,t:4,k:'woven_shorts'},'fine woven shirt':{p:511280124,t:4,k:'woven_shirt'},

'exquisite woven belt':{p:441797484,t:5,k:'woven_be'},'exquisite woven shoes':{p:1162422512,t:5,k:'woven_shoes'},
'exquisite woven cap':{p:620814151,t:5,k:'woven_cap'},'exquisite woven gloves':{p:1617307693,t:5,k:'woven_gloves'},
'exquisite woven shorts':{p:442252346,t:5,k:'woven_shorts'},'exquisite woven shirt':{p:365162243,t:5,k:'woven_shirt'},

'peerless woven belt':{p:1349195810,t:6,k:'woven_be'},'peerless woven shoes':{p:1945743787,t:6,k:'woven_shoes'},
'peerless woven cap':{p:559085155,t:6,k:'woven_cap'},'peerless woven gloves':{p:207881,t:6,k:'woven_gloves'},
'peerless woven shorts':{p:2128345856,t:6,k:'woven_shorts'},'peerless woven shirt':{p:1447863644,t:6,k:'woven_shirt'},

//布装備 T7-T10 8からはまた今度追加する
'ornate woven belt':{p:1688584641,t:7,k:'woven_be'},'ornate woven shoes':{p:116606120,t:7,k:'woven_shoes'},
'ornate woven cap':{p:635237877,t:7,k:'woven_cap'},'ornate woven gloves':{p:1475629311,t:7,k:'woven_gloves'},
'ornate woven shorts':{p:1531238524,t:7,k:'woven_shorts'},'ornate woven shirt':{p:325112899,t:7,k:'woven_shirt'},
}


function getManualRecipe(itemId, itemName, tier) {
  if (!itemName) return null;
  const d = CRAFT_DB[itemName];
  if (!d) return null;
  let stacks;
  const m = d.t ? TIER_MATS[d.t] : null;
  if (d.k === 'direct') {
    stacks = d.s.map(x => ({item_id:x.id,quantity:x.q,item_type:'item'}));
  } else if (d.k === 'tool' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 4, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' },
    { item_id: m.plank, quantity: 2, item_type: 'item' },
    { item_id: m.rope, quantity: 2, item_type: 'item' }
  ];
  } else if (d.k === 'weapon' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 5, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: m.plank, quantity: 1, item_type: 'item' },
    { item_id: m.rope, quantity: 1, item_type: 'item' }
  ];
  } else if (d.k === 'plated_ar' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 5, item_type: 'item' },
    { item_id: m.cloth, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'plated_be' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'plated_bo' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'plated_he' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 4, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'plated_br' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'plated_le' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 4, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'duelist_ar' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 4, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 15, item_type: 'item' }
  ];

} else if (d.k === 'duelist_be' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 5, item_type: 'item' }
  ];

} else if (d.k === 'duelist_bo' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 5, item_type: 'item' }
  ];

} else if (d.k === 'duelist_br' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 5, item_type: 'item' }
  ];

} else if (d.k === 'duelist_he' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 3, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 10, item_type: 'item' }
  ];

} else if (d.k === 'duelist_le' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.ingot, quantity: 3, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' },
    { item_id: ANC_METAL, quantity: 10, item_type: 'item' }
  ];

} else if (d.k === 'leather_be' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'leather_bo' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'leather_ca' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 4, item_type: 'item' },
    { item_id: m.ingot, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'leather_gl' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'leather_le' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 4, item_type: 'item' },
    { item_id: m.ingot, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'leather_sh' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.leather, quantity: 5, item_type: 'item' },
    { item_id: m.ingot, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'woven_be' && m) {
  // belt
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'woven_shoes' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'woven_cap' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 4, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'woven_gloves' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'woven_shorts' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 4, item_type: 'item' },
    { item_id: m.leather, quantity: 1, item_type: 'item' }
  ];

} else if (d.k === 'woven_shirt' && m) {
  stacks = [
    { item_id: d.p, quantity: 1, item_type: 'item' },
    { item_id: m.cloth, quantity: 5, item_type: 'item' },
    { item_id: m.leather, quantity: 2, item_type: 'item' }
  ];

} else if (d.k === 'prev' && d.p) {
    stacks = [{item_id:d.p,quantity:1,item_type:'item'}];
  } else return null;
  return {
    consumedItemStacks: stacks.filter(s => s.item_id),
    craftedItemStacks: [{item_id:itemId,quantity:1}],
    recipeType: 'manual',
    name: '手動クラフト (新規クラフト)',
  };
}

