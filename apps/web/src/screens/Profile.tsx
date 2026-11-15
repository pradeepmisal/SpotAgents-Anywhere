export default function Profile() {
  return (
    <>
      <div className="pagehead"><h1>Profile</h1></div>
      <div className="prof">
        <section className="box">
          <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}><img src={`${import.meta.env.BASE_URL}brand/spotagents-logo.png`} alt="SpotAgents" height={36} style={{ height: 36, width: "auto" }} /></h2>
          <p>SpotAgents places AI guides at real-world spots. At Shaniwar Wada, each spot has its own guide who greets you as you arrive, answers your first question free and offers a deeper paid session on NEAR testnet.</p>
        </section>
        <section className="box">
          <h2>Settings</h2>
          <div className="kv"><span>Network</span><span>NEAR testnet</span></div>
          <div className="kv"><span>Home location</span><span>Never stored</span></div>
        </section>
        <section className="box">
          <h2>Credits</h2>
          <ul>
            <li>Map tiles &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions">CARTO</a> (Positron). Map: <a href="https://leafletjs.com">Leaflet</a> (BSD-2-Clause).</li>
            <li>Icons: <a href="https://lucide.dev">Lucide</a> (ISC).</li>
            <li>Guide avatar "brunette.glb": created at <a href="https://readyplayer.me/">Ready Player Me</a>, distributed in <a href="https://github.com/met4citizen/TalkingHead">met4citizen/TalkingHead</a> (MIT), licensed <a href="https://creativecommons.org/licenses/by-nc/4.0/">CC BY-NC 4.0</a> (non-commercial use).</li>
            <li>Avatar rendering and lip-sync: TalkingHead by Mika Suominen (MIT).</li>
            <li>Virtual visit photos, Wikimedia Commons (see <a href="visit/CREDITS.json">CREDITS.json</a>): Jonathansammy, Nitish kharat, Jatin.mittal06, Varada Phadkay, Vis M (CC BY-SA 3.0 / 4.0); Pravega (CC0).</li>
          </ul>
        </section>
      </div>
    </>
  );
}
