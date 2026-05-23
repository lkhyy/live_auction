import { useEffect, useState } from 'react';

const SCRIPT_LINES: { at: number; text: string }[] = [
  { at: 0, text: '家人们好，欢迎来到直播间！今天这件好物，证书齐全。' },
  { at: 15, text: '起拍价已公布，每次按固定幅度加价，机会难得！' },
  { at: 45, text: '已经有朋友出价了，排名实时更新，没上车的抓紧！' },
  { at: 90, text: '提醒：最后 30 秒内出价会触发延时，别在最后关头错过。' },
  { at: 150, text: '倒计时进入白热化，价高者得！' },
  { at: 210, text: '感谢参与，成交后请及时完成支付。' },
];

interface Props {
  running?: boolean;
}

export default function HostScriptTicker({ running = true }: Props) {
  const [line, setLine] = useState(SCRIPT_LINES[0].text);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      setElapsed(sec);
      const current = [...SCRIPT_LINES].reverse().find((s) => sec >= s.at);
      if (current) setLine(current.text);
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        padding: '8px 12px',
        fontSize: 13,
        lineHeight: 1.4,
        borderRadius: 8,
        margin: '8px 12px',
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>主播说 · {elapsed}s</div>
      {line}
    </div>
  );
}
