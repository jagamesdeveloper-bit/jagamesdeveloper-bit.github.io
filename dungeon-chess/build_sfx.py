"""Builds sfx.js (base64 mp3 sound bank) and music/*.mp3 from CC0 sources.
Sources (all CC0): Kenney Impact Sounds, RPG Audio, Interface Sounds (kenney.nl);
OpenGameArt: 'Into the Ruined Temple', 'Evil temple Ambiance loop'.
Usage: python3 build_sfx.py <dir containing impact-sounds/ rpg-audio/ interface-sounds/ and the two music files>"""
import base64, json, subprocess, sys, tempfile, os, pathlib
src = pathlib.Path(sys.argv[1])
def find(pack, name):
    for ext in ('ogg', 'wav', 'mp3'):
        for p in (src / pack).rglob(f'{name}.{ext}'):
            return p
    raise SystemExit(f'missing {pack}/{name}')
I, R, U = 'impact-sounds', 'rpg-audio', 'interface-sounds'
BANK = {
 'soft':   [(I,'impactSoft_medium_000'),(I,'impactSoft_medium_001'),(I,'impactSoft_medium_002'),(I,'impactSoft_heavy_001')],
 'step':   [(I,'footstep_concrete_000'),(I,'footstep_concrete_001'),(I,'footstep_concrete_002'),(I,'footstep_concrete_003')],
 'coins':  [(R,'handleCoins'),(R,'handleCoins2')],
 'bell':   [(I,'impactBell_heavy_000'),(I,'impactBell_heavy_001'),(I,'impactBell_heavy_002')],
 'anvil':  [(I,'impactMetal_heavy_001'),(I,'impactMetal_heavy_002'),(I,'impactMetal_heavy_003')],
 'pot':    [(R,'metalPot1'),(R,'metalPot2'),(R,'metalPot3')],
 'select': [(U,'select_002'),(U,'select_004'),(U,'select_006')],
 'heal':   [(U,'pluck_001'),(U,'pluck_002')],
 'block':  [(I,'impactMetal_medium_000'),(I,'impactMetal_medium_002'),(I,'impactMetal_medium_003')],
 'hurt':   [(I,'impactPunch_heavy_000'),(I,'impactPunch_heavy_001'),(I,'impactPunch_heavy_002')],
 'death':  [(I,'impactGlass_heavy_001'),(I,'impactGlass_heavy_002')],
 'whoosh': [(R,'knifeSlice'),(R,'knifeSlice2'),(R,'drawKnife1'),(R,'drawKnife2')],
 'glass':  [(U,'glass_002'),(U,'glass_004'),(U,'glass_006')],
 'confirm':[(U,'confirmation_001'),(U,'confirmation_003'),(U,'confirmation_004')],
 'quake':  [(I,'impactMining_002'),(I,'impactMining_003')],
 'zap':    [(U,'glitch_001'),(U,'glitch_002'),(U,'glitch_003')],
 'cloth':  [(R,'cloth1'),(R,'cloth2'),(R,'cloth3'),(R,'clothBelt')],
 'stone':  [(I,'impactPlate_heavy_000'),(I,'impactPlate_heavy_001')],
 'hit':    [(I,'impactPlate_light_000'),(I,'impactPlate_light_001'),(I,'impactPlate_light_004'),(I,'impactMetal_light_000'),(I,'impactMetal_light_003')],
 'kill':   [(I,'impactPlate_medium_000'),(I,'impactPlate_medium_001'),(I,'impactPlate_medium_002'),(I,'impactPlate_medium_003'),(I,'impactGlass_medium_000')],
 'tick':   [(U,'tick_001'),(U,'tick_002'),(U,'tick_004')],
 'creak':  [(R,'creak1'),(R,'creak2'),(R,'creak3')],
 'cast':   [(I,'impactBell_heavy_003'),(I,'impactBell_heavy_004'),(R,'creak2')],
 'open':   [(U,'maximize_004'),(U,'maximize_008'),(U,'open_001')],
 'door':   [(R,'doorOpen_1'),(R,'doorOpen_2')],
 'crashBig':  [(I,'impactPlate_heavy_000'),(I,'impactPlate_heavy_003'),(I,'impactMining_001')],
 'crashSmall':[(I,'impactMining_000'),(I,'impactMining_002'),(I,'impactPlate_medium_004')],
}
def enc(path, dur, bitrate='56k', ar='32000'):
    out = tempfile.mktemp(suffix='.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-t',str(dur),'-af',f'afade=t=out:st={max(0,dur-0.25)}:d=0.25',
                    '-ac','1','-ar',ar,'-b:a',bitrate,out],check=True)
    return out
data = {}
total = 0
for name, files in BANK.items():
    data[name] = []
    for pack, f in files:
        o = enc(find(pack, f), 1.6 if name not in ('bell','cast','death') else 2.2)
        b = open(o,'rb').read(); os.unlink(o); total += len(b)
        data[name].append('data:audio/mpeg;base64,' + base64.b64encode(b).decode())
here = pathlib.Path(__file__).parent
(here/'sfx.js').write_text('window.SFX=' + json.dumps(data, separators=(',',':')) + ';\n')
print('sfx.js', total//1024, 'KB of mp3,', sum(len(v) for v in BANK.values()), 'samples')
for name, f, dur in (('explore', 'ruined.mp3', 150), ('boss', 'evil_temple.ogg', 90)):
    o = enc(src / f, dur, '40k', '24000'); 
    # keep the loop tail clean: the fade-out above is replaced by the player's own fades
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(src/f),'-t',str(dur),'-ac','1','-ar','24000','-b:a','40k',str(here/'music'/f'{name}.mp3')],check=True)
    os.unlink(o)
    print(name, (here/'music'/f'{name}.mp3').stat().st_size//1024, 'KB')
