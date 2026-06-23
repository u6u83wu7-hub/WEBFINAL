import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ��������� ES Module 撠���函�� __dirname ���撱箏之瘜� ���������
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'transfer.db');

let db;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('��� 霈������Ｘ��鞈����摨恬��', DB_PATH);
  } else {
    db = new SQL.Database();
    console.log('��� 撱箇����啗�����摨�');
  }

  db.run('PRAGMA journal_mode = WAL;');

  db.run(`
    CREATE TABLE IF NOT EXISTS checklists (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      target_grade INTEGER NOT NULL,
      category     TEXT    NOT NULL,
      text         TEXT    NOT NULL,
      is_required  INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS credit_records (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      original_school  TEXT    NOT NULL,
      original_dept    TEXT    NOT NULL,
      original_course  TEXT    NOT NULL,
      credits          INTEGER NOT NULL,
      target_course    TEXT    NOT NULL,
      status           TEXT    NOT NULL,
      advice           TEXT,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  const checklistCount = db.exec('SELECT COUNT(*) AS cnt FROM checklists');
  const cnt1 = checklistCount[0]?.values[0][0] ?? 0;

  if (cnt1 === 0) {
    const checklistData = [
      [2, '��萄蝴���霅�隞�', '��������∠�唾�������典飛霅���������������萄蝴蝺拙噩��唾����詻��嚗���澆�亙飛敺� 7 ��亙�抒像鈭文飛��������萄蝴璆剖��蝯�嚗���暹��撠�鋡恍�����', 1],
      [2, '撣唾����唾��',   '摰���� NTU G-Suite 摮貉��撣唾�������剁��@ntu.edu.tw嚗�嚗������曄�唾��敺� 48 撠������批�����嚗�撣唾��撠�雿���粹�貉玨�����∪��蝟餌絞��餃�交��霅�', 1],
      [2, '摮詨����萄��',   '���憒亙����～��甇瑕僑���蝮曉�殷��隤�霅���穿��������������蝘�隤脩��憭抒雇���嚗���單����������唾��摮詨����萄��撖拇�賂����芣迫��亦�粹��摮詨��蝚砌����望�����鈭� 17:00', 1],
      [2, '��亙熒瑼Ｘ��',   '��唾�箏之���閮剝�恍�� B1 ��交炎銝剖��摰������啁����亙熒瑼Ｘ�伐��鞎餌�函�� $500嚗����蝬脰楝���蝝�嚗�嚗�蝯����敶梢�踹挪�����賜惜鞈����', 1],
      [2, '雿�摰輻�餉��',   '摰����摰輯����賜惜��餉�����憛怠神��∪��蝘�撅���芯蜓��喳�梧����駁����啣��敶梢�蹂����嗅�交�嗚��撘勗�Ｗ�拙飛�����唾��鞈���潘��', 1],
      [2, '��貉玨閬����',   '���閬質玨蝔�蝬脩Ⅱ隤�蝟餅��敹�靽株玨��啣��嚗�憭找��頧���仿��鋆�靽株�喳�� 8 摮詨�����霅�嚗�撱箄降�����亦頂摮豢�� LINE 蝢文��敺���貉玨撖����', 0],
      [2, '蝷曄黎������',   '������ PTT NTU ��踹��蝟餅��頧�摮貊�� Facebook 蝷曉��嚗���脣��蝚砌�����隤脩��閰���寡�����������憟質��閮�', 0],
      [3, '��萄蝴���霅�隞�', '��������∠�唾�������典飛霅���������������萄蝴蝺拙噩��唾����詻��嚗���澆�亙飛敺� 7 ��亙�抒像鈭文飛��������萄蝴璆剖��蝯�嚗���暹��撠�鋡恍�����', 1],
      [3, '撣唾����唾��',   '摰���� NTU G-Suite 摮貉��撣唾�������剁��@ntu.edu.tw嚗�嚗������曄�唾��敺� 48 撠������批�����', 1],
      [3, '摮詨����萄��',   '���憒亙����～��甇瑕僑���蝮曉�殷��隤�霅���穿��������������蝘�隤脩��憭抒雇���嚗���唾��摮詨����萄��嚗�憭找��頧���交�萄��摮詨��銝������� 40 摮詨��', 1],
      [3, '��Ｘ平摮詨��蝣箄��', '���蝟餉齒��拍��蝣箄����拚����Ｘ平���靽桀飛������靽格平撟湧��嚗�憭找��頧���仿��撣� 2 撟渡�Ｘ平嚗�嚗������拇��隤脤�踹��憭批��憯����', 1],
      [3, '��亙熒瑼Ｘ��',   '��唾�箏之���閮剝�恍�� B1 ��交炎銝剖��摰������啁����亙熒瑼Ｘ�伐��鞎餌�函�� $500嚗����蝬脰楝���蝝�嚗�', 1],
      [3, '��詨�瑁����拙飛���', '蝣箄����詨�瑞�����蝟餅�����摮賊�����撘勗�Ｗ�拙飛�����唾��鞈���潘��憭找��頧���亦洵銝�摮豢�����蝮暸��璅�嚗���� 5%嚗���喳�舐�唾��', 0],
      [3, '撖衣��/鈭斗��閬����', '��典��鈭斗��閮���怨��瘙���冽�⊥遛銝�摮豢�������賜�唾��嚗������抵��������鈭�������蝣箄�� deadline嚗���踹����臬仃璈����', 0],
      [3, '蝷曄黎������',   '������ PTT NTU ��踹��蝟餅��頧�摮貊�� Facebook 蝷曉��嚗���孵�亦�����憭找��撣貉◤��∠�����蝟餃��靽柴��靽株玨���摨����憿�', 0],
    ];

    checklistData.forEach(([grade, cat, text, req]) => {
      db.run(
        'INSERT INTO checklists (target_grade, category, text, is_required) VALUES (?, ?, ?, ?)',
        [grade, cat, text, req]
      );
    });
    console.log('��� checklists ���鞈����撖怠�亙�����');
  }

  const creditCount = db.exec('SELECT COUNT(*) AS cnt FROM credit_records');
  const cnt2 = creditCount[0]?.values[0][0] ?? 0;

  if (cnt2 === 0) {
    const creditData = [
      ['頛�隞�憭批飛', '鞈�閮�撌亦��摮貊頂', '鞈����蝯�瑽����瞍�蝞�瘜�', 3, '瞍�蝞�瘜�閮剛��', '������',
       '���撣嗅����∟玨蝬勗����扯”��� A+ ���蝮曉�殷��蝟餉齒��拍����湔�亥��蝡�嚗���游��瘚�蝔�銝���� 15 ���������'],
      ['瘛⊥��憭批飛', '��餅��撌亦��摮貊頂', '閮�蝞�璈�蝯�蝜����蝯�瑽�', 3, '閮�蝞�璈�蝯�瑽�', '������',
       '隤脩雇撟曆��銝�璅∩��璅�嚗�������蝚�隤芣�胯��銴�鋆質票銝����嚗�銝���勗�扳�嗅�圈����������乓��'],
      ['��勗�喳之摮�', '蝯梯��摮貊頂', '蝯梯��摮賂��銝�嚗�嚗�鈭�嚗�', 6, '璈�������蝯梯��', '���鋆�隤脩雇',
       '���隤脩雇蝻箏��鞎�瘞�蝯梯����� MCMC 蝡�蝭�嚗����鋆�靽桐��������摰�蝺�銝�隤脩��銝衣像鈭斗�芸��嚗�蝝�銝���梯��隞嗚��'],
      ['銝剖��憭批飛', '��餅��撌亦��摮貊頂', '��餉楝摮賂��銝�嚗�', 3, '��餉楝摮�', '���鋆�隤脩雇',
       '摮詨����詨榆頝���舫����蛛��������靽柴����餉楝摮詨祕撽����1 摮詨��敺������詨����冽�豢�萄�����'],
      ['������憭批飛', '鞈�閮�蝞∠��摮貊頂', '��拐辣撠����蝔�撘�閮剛��', 3, '蝔�撘�閮剛�����撖衣��', '������',
       '���蝮� A 隞乩��撟曆��銝����隤脩雇蝝啁��嚗���湔�仿��嚗����撣訾��敹����'],
      ['撖西��憭批飛', '鞈�閮�蝘�������蝞∠��摮貊頂', '鞈����摨怎恣���蝟餌絞', 3, '鞈����摨怎頂蝯�', '擏����',
       '���隤脩��雿輻�� MS Access嚗���祆�∩蝙��� PostgreSQL嚗�������隤���箏榆��圈��憭抒�湔�仿��隞嗚��'],
      ['�����箏之摮�', '撌交平撌亦�����蝞∠��摮貊頂', '雿�璆剔��蝛�', 3, '雿�璆剔��蝛�', '������',
       '隤脩雇擃�摨阡�����嚗�撖拇�詨����∠Ⅱ隤�敺���拙予撠梢�����嚗�撱箄降���銝������怨�������瑕�����撖拇�乓��'],
      ['��Ｙ�脣之摮�', '鞈�閮�撌亦��摮貊頂', '頠�擃�撌亦��', 3, '頠�擃�撌亦�����撖血��', '���鋆�隤脩雇',
       '���隤脩雇蝻箏�� Agile/Scrum 撖血��蝡�蝭�嚗�鋆�銝���拍��隢������梯��敹�敺�敺���脫�孵�����'],
    ];

    creditData.forEach(row => {
      db.run(
        `INSERT INTO credit_records
          (original_school, original_dept, original_course, credits, target_course, status, advice)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        row
      );
    });
    console.log('��� credit_records ���鞈����撖怠�亙�����');
  }

  saveDB();
  console.log('��� 鞈����摨怠��憪����摰����');
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDB() {
  return db;
}

// ��������� 靽格迤��臬�箸�孵�� ���������
export { initDB, getDB, saveDB };