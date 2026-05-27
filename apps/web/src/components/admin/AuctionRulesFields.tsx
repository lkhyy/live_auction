import { Collapse, Form, InputNumber, Select, Switch } from 'antd';
import { DEFAULT_ANOMALY_DETECTION } from '@live-auction/shared';

/** 添加/编辑竞拍规则共用表单项 */
export default function AuctionRulesFields({ prefix = ['rules'] }: { prefix?: string[] }) {
  const field = (name: string | string[]) => [...prefix, ...(Array.isArray(name) ? name : [name])];
  const ad = (name: string | string[]) => field(['anomalyDetection', ...(Array.isArray(name) ? name : [name])]);

  return (
    <>
      <Form.Item name={field('startPrice')} label="起拍价" rules={[{ required: true }]}>
        <InputNumber min={0} style={{ width: '100%' }} addonBefore="¥" />
      </Form.Item>
      <Form.Item name={field('minIncrement')} label="固定加价" rules={[{ required: true }]}>
        <InputNumber min={1} style={{ width: '100%' }} addonBefore="¥" />
      </Form.Item>
      <Form.Item name={field('capPrice')} label="封顶价 / 评估价参考">
        <InputNumber min={1} style={{ width: '100%' }} addonBefore="¥" />
      </Form.Item>
      <Form.Item
        name={field('reservePrice')}
        label="最低限价 / 成本价"
        tooltip="低于此价流拍；也用于异常低价检测"
      >
        <InputNumber min={1} style={{ width: '100%' }} addonBefore="¥" placeholder="可选" />
      </Form.Item>
      <Form.Item name={field('durationSeconds')} label="竞拍时长(秒)">
        <InputNumber min={60} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        name={field(['softClose', 'enabled'])}
        label="延时机制"
        valuePropName="checked"
      >
        <Switch checkedChildren="开启" unCheckedChildren="关闭" />
      </Form.Item>
      <Form.Item name={field(['softClose', 'extensionSeconds'])} label="每次延时(秒)">
        <Select options={[10, 15, 20, 30].map((n) => ({ value: n, label: `${n}秒` }))} />
      </Form.Item>
      <Form.Item name={field(['softClose', 'triggerWindowSeconds'])} label="触发窗口(秒)">
        <InputNumber min={1} max={120} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name={field(['softClose', 'maxTotalExtensionSeconds'])} label="最大总延时(秒)">
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        name={ad('enabled')}
        label="竞价异常检测"
        valuePropName="checked"
        tooltip="检测到异常时控制台预警，不自动取消；主播可手动取消异常竞拍"
      >
        <Switch checkedChildren="开启" unCheckedChildren="关闭" />
      </Form.Item>

      <Collapse
        size="small"
        items={[
          {
            key: '1',
            label: '一、数值区间',
            children: (
              <>
                <Form.Item name={ad(['range', 'lowPriceRatio'])} label="异常低价比例">
                  <InputNumber min={0.1} max={1} step={0.05} style={{ width: '100%' }} addonAfter="×最低限价" />
                </Form.Item>
                <Form.Item name={ad(['range', 'highPriceRatio'])} label="异常高价比例">
                  <InputNumber min={1} style={{ width: '100%' }} addonAfter="×评估价" />
                </Form.Item>
                <Form.Item name={ad(['range', 'appraisalPrice'])} label="评估价(可选)">
                  <InputNumber min={1} style={{ width: '100%' }} addonBefore="¥" placeholder="默认同封顶价" />
                </Form.Item>
                <Form.Item name={ad(['range', 'rejectExtremeValues'])} label="拒绝极端值" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name={ad(['range', 'maxReasonableMultiplier'])} label="合理价格上限倍数">
                  <InputNumber min={10} style={{ width: '100%' }} addonAfter="×起拍价" />
                </Form.Item>
              </>
            ),
          },
          {
            key: '2',
            label: '二、加价幅度',
            children: (
              <>
                <Form.Item name={ad(['increment', 'maxIncrementRatio'])} label="最大单次涨幅比例">
                  <InputNumber min={0.1} max={5} step={0.1} style={{ width: '100%' }} addonAfter="×当前价" />
                </Form.Item>
                <Form.Item name={ad(['increment', 'maxIncrementAmount'])} label="最大单次涨幅金额">
                  <InputNumber min={1} style={{ width: '100%' }} addonBefore="¥" placeholder="可选" />
                </Form.Item>
              </>
            ),
          },
          {
            key: '3',
            label: '三、时序行为',
            children: (
              <>
                <Form.Item name={ad(['timing', 'windowSeconds'])} label="高频检测窗口(秒)">
                  <InputNumber min={5} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['timing', 'maxBidsInWindow'])} label="窗口内全场出价上限">
                  <InputNumber min={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['timing', 'maxUserBidsInWindow'])} label="窗口内单用户出价上限">
                  <InputNumber min={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['timing', 'endSnipeWindowSeconds'])} label="结束前狙击窗口(秒)">
                  <InputNumber min={5} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['timing', 'endSnipeIncrementRatio'])} label="狙击窗口最小涨幅比例">
                  <InputNumber min={0.1} max={2} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['timing', 'maxUserTotalBids'])} label="单用户累计出价上限">
                  <InputNumber min={5} style={{ width: '100%' }} />
                </Form.Item>
              </>
            ),
          },
          {
            key: '4',
            label: '四、串通检测',
            children: (
              <>
                <Form.Item name={ad(['collusion', 'minBidders'])} label="最少参与人数">
                  <InputNumber min={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['collusion', 'spreadRatio'])} label="报价趋同价差比例">
                  <InputNumber min={0.01} max={0.5} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['collusion', 'alternatingMinCycles'])} label="交替加价最少轮数">
                  <InputNumber min={2} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['collusion', 'pumpTransferRatio'])} label="抬价接盘涨幅比例">
                  <InputNumber min={0.1} max={2} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
              </>
            ),
          },
          {
            key: '5',
            label: '五、统计偏离',
            children: (
              <>
                <Form.Item name={ad(['stats', 'minSamples'])} label="最少样本数">
                  <InputNumber min={3} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['stats', 'stdDevMultiplier'])} label="标准差倍数">
                  <InputNumber min={1} max={10} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name={ad(['stats', 'isolationGapRatio'])} label="孤立点断层倍数">
                  <InputNumber min={1.5} max={10} step={0.5} style={{ width: '100%' }} />
                </Form.Item>
              </>
            ),
          },
        ]}
      />
    </>
  );
}

export { DEFAULT_ANOMALY_DETECTION };
