import { LlmProvider, ChatMessage, ChatOptions, ChatResult, StreamChunk } from '../llm-provider.interface';

const MOCK_RESPONSES: Record<string, string> = {
  // ── Ecommerce: Fruit Shop ──
  default: '你好，我是智能客服助手。你可以直接问我商品规格、配送时效、售后处理或课程信息。',

  product_fruit: '可以先参考这几款常被咨询的商品：\n\n1. **广西妃子笑荔枝** - 4.5 斤装 ¥79.80，产地直发，适合当季尝鲜\n2. **云南高原蓝莓** - 125g*4 盒 ¥118.00，适合家庭即食\n3. **海南麒麟瓜** - 4.5-5.5 斤 ¥46.80，适合周末聚餐\n\n如果你告诉我收货城市和预算，我可以继续帮你缩小范围。',

  product_recommend: '按最近咨询量来看，比较热销的是：\n\n- **妃子笑荔枝**：看重新鲜度和次日达的用户会优先选它\n- **蓝莓 4 盒装**：复购率高，适合家庭日常吃\n- **麒麟瓜大果**：办公室和聚餐场景下单比较多\n\n如果你更在意送礼，我也可以再推荐礼盒型商品。',

  price: '当前常卖规格价格如下：\n\n**耙耙柑**\n- 5 斤尝鲜装：¥69.80\n- 9 斤家庭装：¥118.00\n\n**蓝莓**\n- 125g*4 盒：¥118.00\n- 125g*8 盒：¥219.00\n\n**麒麟瓜**\n- 4.5-5.5 斤：¥46.80\n- 6-7 斤：¥56.80\n\n**妃子笑荔枝**\n- 4.5 斤装：¥79.80\n- 9 斤装：¥148.00',

  order: '订单出库后会同步物流轨迹。华东、华南大部分城市次日达，其他地区一般 2-4 天送达；如果你给我订单号，我可以帮你判断当前节点。',

  shipping: '配送说明如下：\n\n- **配送方式：** 生鲜冷链或生鲜专线\n- **发货时效：** 工作日 16:00 前付款的订单优先当日出库\n- **包邮门槛：** 常规满 79 元包邮，偏远地区满 129 元包邮\n- **时效范围：** 次日达区域通常隔天送达，其他地区 2-4 天\n\n如果你告诉我收货城市，我可以给更具体的判断。',

  aftersale: '如果遇到坏果、渗汁或运输挤压，请先保留外箱和商品照片，并在签收后 24 小时内提交。核实后可安排补发、补偿或原路退款，退款一般会在 1-3 个工作日到账。',

  coupon: '店铺活动以实时结算页为准，最近常见的是满 168 减 12、满 249 减 20。部分秒杀和限量商品不参与叠加，最终以结算页展示的优惠为准。',

  transfer: '好的，已为你转接人工客服。人工在线时间为每天 08:30-23:00，如果当前排队较多请稍等片刻。',

  purchase: '我先按常见组合帮你算一下：\n- 麒麟瓜大果：¥56.80\n- 蓝莓 4 盒装：¥118.00\n- 小计：¥174.80\n- 满 168 减 12 后：**¥162.80**\n\n如果你确定要买，我可以继续帮你整理下单信息。',

  // ── School: Coding Training ──
  course_list: '向上数字技能中心当前常报课程有：\n\n- **Python 自动化入门** - 4380 元，适合零基础办公提效\n- **数据分析实战** - 6980 元，适合运营/行政/产品转岗补强\n- **新媒体运营实训** - 5680 元，适合内容和电商运营方向\n- **Scratch 启蒙班** - 3690 元，适合 8-10 岁孩子\n\n成人班有晚班、周末班和线上直播班，想听哪一门我可以展开说。',

  course_python: '关于 Python 自动化入门班：\n\n- **内容方向：** Excel 处理、表单自动化、基础语法、简单网页数据采集\n- **适合人群：** 零基础上班族、行政、运营、助理岗位\n- **学费：** 4380 元\n- **学习形式：** 晚班、周末班、线上直播班可选\n- **回放权限：** 直播回放默认保留 180 天\n\n如果你方便，也可以先约一节试听。',

  course_kids: '关于 Scratch 启蒙班：\n\n- **适合年龄：** 8-10 岁\n- **课堂形式：** 6-8 人小班，含助教协助\n- **内容方向：** 图形化逻辑、角色动画、小游戏制作\n- **学费：** 3690 元\n- **试听方式：** 周末线下试听为主\n\n如果孩子比较慢热，建议先试听再决定报名。',

  course_ai: '如果你关注偏进阶方向，目前更接近的是数据分析实战和后续进阶项目班。我们不会在基础咨询里直接承诺大模型就业结果，但会根据你的基础推荐更合适的学习路径。',

  course_price: '当前常见课程费用如下：\n\n| 课程 | 学费 | 说明 |\n|------|------|------|\n| Python 自动化入门 | ¥4,380 | 零基础、办公提效方向 |\n| 数据分析实战 | ¥6,980 | Excel / SQL / 可视化 |\n| 新媒体运营实训 | ¥5,680 | 内容与投放基础 |\n| Scratch 启蒙班 | ¥3,690 | 8-10 岁线下小班 |\n\n是否有团报减免和分期活动，以当期招生页为准。',

  course_trial: '试听说明：\n\n- 每门正式开班前可以预约 **1 次试听**\n- 试听需要至少提前一天登记姓名、电话和意向课程\n- 成人班可安排线上或线下试听\n- 少儿班通常安排周末线下试听\n\n如果你告诉我想听哪门课，我可以继续帮你整理信息。',

  course_refund: '退费规则以报名协议为准，当前常见口径是：\n\n- **开课前：** 可全额退款\n- **开课后 7 天内且未超过总课时 20%：** 可按协议申请退还剩余费用\n- **教材和已开通考试服务：** 不支持退费\n\n如果你已经报名，我建议把班型和开课时间发我，我可以帮你判断。',

  course_employment: '成人班结课后一般会提供项目复盘、简历修改建议和岗位投递辅导，但不会承诺包就业、保面或固定 offer 数量。更适合把它理解为求职支持，而不是结果承诺。',

  // ── Common ──
  unknown: '抱歉，这个问题我暂时无法回答。我已记录下来，会尽快补充相关知识。\n\n您可以：\n1. 换个方式描述您的问题\n2. 联系人工客服获取帮助\n3. 查看我们的常见问题解答',
};

export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  private latencyMs: number;

  constructor(latencyMs = 300) {
    this.latencyMs = latencyMs;
  }

  async chat(messages: ChatMessage[], _options?: ChatOptions): Promise<ChatResult> {
    await this.delay();
    const lastMessage = messages[messages.length - 1]?.content || '';
    const content = this.getMockResponse(lastMessage);
    return {
      content,
      usage: { promptTokens: 100, completionTokens: 50 },
      finishReason: 'stop',
    };
  }

  async *chatStream(messages: ChatMessage[], _options?: ChatOptions): AsyncGenerator<StreamChunk> {
    const lastMessage = messages[messages.length - 1]?.content || '';
    const content = this.getMockResponse(lastMessage);
    const words = content.split(/(?<=[，。！？\n])/);

    for (const word of words) {
      await this.delay(50);
      yield { content: word, done: false };
    }
    yield { content: '', done: true, usage: { promptTokens: 100, completionTokens: 50 } };
  }

  private getMockResponse(input: string): string {
    const lower = input.toLowerCase();

    // ── Transfer to human (highest priority) ──
    if (lower.includes('人工') || lower.includes('转接客服') || lower.includes('不想跟机器人')) {
      return MOCK_RESPONSES.transfer;
    }

    // ── School / Course keywords ──
    if (lower.includes('课程') || lower.includes('培训班') || lower.includes('培训中心') || lower.includes('训练营')) {
      if (lower.includes('python') || lower.includes('自动化')) return MOCK_RESPONSES.course_python;
      if (lower.includes('少儿') || lower.includes('scratch') || lower.includes('孩子') || lower.includes('小孩')) return MOCK_RESPONSES.course_kids;
      if (lower.includes('ai') || lower.includes('人工智能') || lower.includes('大模型') || lower.includes('数据分析')) return MOCK_RESPONSES.course_ai;
      return MOCK_RESPONSES.course_list;
    }
    if (lower.includes('试听') || lower.includes('体验课') || lower.includes('免费听')) return MOCK_RESPONSES.course_trial;
    if (lower.includes('退费') || lower.includes('退学费') || lower.includes('不学了') || lower.includes('退款') && lower.includes('课')) return MOCK_RESPONSES.course_refund;
    if (lower.includes('就业') || lower.includes('找工作') || lower.includes('工作') || lower.includes('就业率')) return MOCK_RESPONSES.course_employment;
    if (lower.includes('学费') || lower.includes('多少钱') && (lower.includes('课') || lower.includes('学'))) return MOCK_RESPONSES.course_price;
    if ((lower.includes('学') || lower.includes('报名')) && (lower.includes('编程') || lower.includes('python') || lower.includes('数据分析') || lower.includes('运营') || lower.includes('ai'))) return MOCK_RESPONSES.course_list;

    // ── Ecommerce keywords ──
    if (lower.includes('推荐') || lower.includes('有什么好') || lower.includes('有哪些') || lower.includes('什么水果') || lower.includes('当季')) return MOCK_RESPONSES.product_recommend;
    if ((lower.includes('蓝莓') || lower.includes('耙耙柑') || lower.includes('荔枝') || lower.includes('麒麟瓜') || lower.includes('榴莲')) && (lower.includes('价格') || lower.includes('多少钱') || lower.includes('规格'))) {
      return MOCK_RESPONSES.price;
    }
    if (lower.includes('蓝莓') || lower.includes('耙耙柑') || lower.includes('荔枝') || lower.includes('麒麟瓜') || lower.includes('榴莲')) return MOCK_RESPONSES.product_fruit;
    if (lower.includes('价格') || lower.includes('多少钱') || lower.includes('便宜') || lower.includes('贵') || lower.includes('优惠') || lower.includes('折扣') || lower.includes('活动')) return MOCK_RESPONSES.coupon;
    if (lower.includes('订单') || lower.includes('发货') || lower.includes('快递') || lower.includes('什么时候到') || lower.includes('几天到')) return MOCK_RESPONSES.order;
    if (lower.includes('物流') || lower.includes('配送') || lower.includes('包邮') || lower.includes('运费')) return MOCK_RESPONSES.shipping;
    if (lower.includes('售后') || lower.includes('坏果') || lower.includes('质量') || lower.includes('坏了') || lower.includes('发黑') || lower.includes('投诉')) return MOCK_RESPONSES.aftersale;
    if (lower.includes('退款') || lower.includes('退钱')) return MOCK_RESPONSES.aftersale;
    if (lower.includes('优惠') || lower.includes('折扣') || lower.includes('券') || lower.includes('满减') || lower.includes('新客')) return MOCK_RESPONSES.coupon;
    if (lower.includes('买') || lower.includes('购买') || lower.includes('下单') || lower.includes('付款') || lower.includes('加购')) return MOCK_RESPONSES.purchase;
    if (lower.includes('商品') || lower.includes('产品') || lower.includes('水果')) return MOCK_RESPONSES.product_fruit;

    return MOCK_RESPONSES.default;
  }

  private delay(ms?: number) {
    return new Promise((resolve) => setTimeout(resolve, ms || this.latencyMs));
  }
}
