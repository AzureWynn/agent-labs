import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface Profile {
  readonly id: string;
  readonly owner: string;
  readonly species: '猫' | '狗';
  readonly pet: string;
  readonly age: number;
  readonly condition: string;
  readonly conditionQuery: string;
  readonly eventLabel: '疫苗' | '复查' | '驱虫';
  readonly eventDate: string;
  readonly phone: string;
  readonly address: string;
  readonly care: string;
  readonly careQuery: string;
}

interface Fact {
  readonly id: string;
  readonly content: string;
  readonly tags: readonly string[];
}

interface Query {
  readonly query: string;
  readonly expectedFactIds: readonly string[];
}

interface Round {
  readonly round: number;
  readonly user: string;
  readonly assistant: string;
}

interface UserData {
  readonly id: string;
  readonly owner: string;
  readonly pet: {
    readonly name: string;
    readonly species: string;
    readonly age: number;
  };
  readonly facts: readonly Fact[];
  readonly rounds: readonly Round[];
  readonly queries: readonly Query[];
}

const profiles: readonly Profile[] = [
  {
    id: 'u01',
    owner: '王女士',
    species: '猫',
    pet: '花花',
    age: 3,
    condition: '对鸡肉过敏',
    conditionQuery: '花花对什么过敏',
    eventLabel: '疫苗',
    eventDate: '5月10日',
    phone: '13800001111',
    address: '3号楼2单元',
    care: '有轻微牙结石，建议半年复查',
    careQuery: '花花牙结石要注意什么',
  },
  {
    id: 'u02',
    owner: '李先生',
    species: '狗',
    pet: '豆豆',
    age: 5,
    condition: '髋关节不好',
    conditionQuery: '豆豆髋关节怎么样',
    eventLabel: '疫苗',
    eventDate: '6月2日',
    phone: '13900002222',
    address: '5号楼1单元',
    care: '不能长时间爬楼',
    careQuery: '豆豆爬楼要注意什么',
  },
  {
    id: 'u03',
    owner: '张阿姨',
    species: '猫',
    pet: '咪咪',
    age: 8,
    condition: '有慢性肾病',
    conditionQuery: '咪咪肾病要注意什么',
    eventLabel: '复查',
    eventDate: '4月18日',
    phone: '13600003333',
    address: '7号楼3单元',
    care: '要吃处方粮',
    careQuery: '咪咪处方粮怎么吃',
  },
  {
    id: 'u04',
    owner: '陈先生',
    species: '狗',
    pet: '球球',
    age: 1,
    condition: '肠胃敏感',
    conditionQuery: '球球肠胃怎么样',
    eventLabel: '驱虫',
    eventDate: '3月20日',
    phone: '13700004444',
    address: '9号楼2单元',
    care: '不能吃油腻',
    careQuery: '球球不能吃什么',
  },
  {
    id: 'u05',
    owner: '刘女士',
    species: '猫',
    pet: '糖糖',
    age: 2,
    condition: '怀孕了',
    conditionQuery: '糖糖怀孕了吗',
    eventLabel: '疫苗',
    eventDate: '7月8日',
    phone: '13500005555',
    address: '11号楼1单元',
    care: '需要安静环境',
    careQuery: '糖糖需要安静吗',
  },
];

const replies: readonly string[] = [
  '好的，我记下了。',
  '收到，复诊时我会提醒您。',
  '明白了，已经记录。',
  '好的，注意观察。',
  '记下了，您放心。',
];

function buildFacts(profile: Profile): readonly Fact[] {
  return [
    { id: 'f1', content: `用户是${profile.owner}`, tags: ['主人'] },
    {
      id: 'f2',
      content: `用户养了一只${profile.species}，叫${profile.pet}`,
      tags: ['宠物'],
    },
    { id: 'f3', content: `${profile.pet}今年${profile.age}岁`, tags: ['宠物'] },
    { id: 'f4', content: `${profile.pet}${profile.condition}`, tags: ['健康'] },
    {
      id: 'f5',
      content: `${profile.pet}下次${profile.eventLabel}是${profile.eventDate}`,
      tags: ['日程'],
    },
    { id: 'f6', content: `用户电话是${profile.phone}`, tags: ['联系'] },
    { id: 'f7', content: `用户住在${profile.address}`, tags: ['地址'] },
    { id: 'f8', content: `${profile.pet}${profile.care}`, tags: ['照护'] },
  ];
}

function statementVariants(profile: Profile, factId: string): readonly string[] {
  const { owner, species, pet, age, condition, eventLabel, eventDate, phone, address, care } =
    profile;

  switch (factId) {
    case 'f1':
      return [
        `我是${owner}。`,
        `我叫${owner}，今天带${pet}来复诊。`,
        `${owner}，之前来过。`,
        `登记人还是${owner}。`,
      ];
    case 'f2':
      return [
        `我家${species}叫${pet}，今年${age}岁。`,
        `${pet}是我养的${species}，${age}岁了。`,
        `我养了一只${species}，名字叫${pet}。`,
        `还是${pet}，我家的${species}。`,
      ];
    case 'f3':
      return [
        `${pet}今年${age}岁。`,
        `${pet}已经${age}岁了。`,
        `${pet}${age}岁，体型一直这样。`,
        `${pet}现在${age}岁。`,
      ];
    case 'f4':
      return [
        `${pet}${condition}。`,
        `${pet}${condition}，这个要记一下。`,
        `医生说过${pet}${condition}。`,
        `对了，${pet}${condition}。`,
      ];
    case 'f5':
      return [
        `${pet}下次${eventLabel}是${eventDate}。`,
        `${pet}的${eventLabel}安排在${eventDate}。`,
        `${pet}下一次${eventLabel}在${eventDate}。`,
        `${eventDate}要带${pet}去${eventLabel}。`,
      ];
    case 'f6':
      return [
        `我的电话是${phone}。`,
        `联系电话${phone}。`,
        `有事打${phone}找我。`,
        `电话还是${phone}。`,
      ];
    case 'f7':
      return [
        `我住在${address}。`,
        `我家在${address}。`,
        `地址是${address}。`,
        `还是${address}，没搬家。`,
      ];
    case 'f8':
      return [
        `${pet}${care}。`,
        `${pet}${care}，平时要注意。`,
        `另外，${pet}${care}。`,
        `补充一下，${pet}${care}。`,
      ];
    default:
      throw new Error(`未知事实：${factId}`);
  }
}

function assistantReply(round: number): string {
  const reply = replies[(round - 1) % replies.length];
  if (!reply) throw new Error('回复模板为空');
  return reply;
}

function buildRounds(profile: Profile): readonly Round[] {
  const facts = buildFacts(profile);
  const variants = new Map(facts.map((fact) => [fact.id, statementVariants(profile, fact.id)]));
  const rounds: Round[] = [];
  let round = 0;

  for (let cycle = 0; cycle < 3; cycle += 1) {
    for (const fact of facts) {
      round += 1;
      const statement = variants.get(fact.id)?.[cycle];
      if (!statement) throw new Error(`缺少说法：${fact.id}/${cycle}`);
      rounds.push({ round, user: statement, assistant: assistantReply(round) });
    }
  }

  for (let index = 0; index < 6; index += 1) {
    const fact = facts[index];
    if (!fact) throw new Error(`缺少事实：${index}`);
    round += 1;
    const statement = variants.get(fact.id)?.[3];
    if (!statement) throw new Error(`缺少说法：${fact.id}/3`);
    rounds.push({ round, user: statement, assistant: assistantReply(round) });
  }

  return rounds;
}

function buildQueries(profile: Profile): readonly Query[] {
  return [
    { query: `我家${profile.species}的名字`, expectedFactIds: ['f2'] },
    { query: `${profile.pet}今年几岁`, expectedFactIds: ['f3'] },
    { query: profile.conditionQuery, expectedFactIds: ['f4'] },
    {
      query: `${profile.pet}下次${profile.eventLabel}什么时候`,
      expectedFactIds: ['f5'],
    },
    { query: '电话是多少', expectedFactIds: ['f6'] },
    { query: profile.careQuery, expectedFactIds: ['f8'] },
  ];
}

function buildUser(profile: Profile): UserData {
  return {
    id: profile.id,
    owner: profile.owner,
    pet: {
      name: profile.pet,
      species: profile.species,
      age: profile.age,
    },
    facts: buildFacts(profile),
    rounds: buildRounds(profile),
    queries: buildQueries(profile),
  };
}

const outputPath = fileURLToPath(
  new URL('../../../../scenarios/pet-clinic-memory/scenario.json', import.meta.url),
);

if (existsSync(outputPath) && !process.argv.includes('--force')) {
  throw new Error(`场景已存在，不覆盖：${outputPath}`);
}

const scenario = {
  name: 'pet-clinic-memory',
  note: '5 位用户各 30 轮复诊对话；同一事实用不同说法重复出现，用于观察 ADD-only 记忆的重复堆积与去重。',
  users: profiles.map(buildUser),
};

writeFileSync(outputPath, `${JSON.stringify(scenario, null, 2)}\n`, 'utf8');
console.log(`wrote ${outputPath}`);
