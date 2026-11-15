export function PinMark({ size = 28 }: { size?: number }) {
  return <img src={`${import.meta.env.BASE_URL}brand/spotagents-mark.png`} width={size} height={size} alt="" aria-hidden="true" />;
}

export default function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="logo" onClick={onClick} aria-label="SpotAgents home">
      <img src={`${import.meta.env.BASE_URL}brand/spotagents-logo.png`} alt="SpotAgents" height={30} style={{ height: 30, width: "auto", display: "block" }} />
    </button>
  );
}
