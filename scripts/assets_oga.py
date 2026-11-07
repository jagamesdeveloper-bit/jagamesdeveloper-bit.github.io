#!/usr/bin/env python3
"""v1.5 audio pipeline for the five flagship games: only recorded CC0 material from OpenGameArt.
No synthesised sound anywhere. Source packs are unpacked under /tmp/oga/dl, music under /tmp/oga/m/dl.

usage: assets_oga.py [slug ...]
Writes games/<slug>/audio/*.mp3, assets.js (sfx + musicMenu + musicPlay + fonts) and CREDITS.txt.
"""
import os, sys, glob, json, shutil, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DL = '/tmp/oga/dl'
MUS = '/tmp/oga/m/dl'
FONTS = os.path.join(ROOT, 'shared', 'fonts')

# pack key -> (folder under DL, title, author, OpenGameArt page)
PACKS = {
    'WM':   ('x_100-CC0-wood-metal-SFX', '100 CC0 metal and wood SFX', 'Barina', 'https://opengameart.org/content/100-cc0-metal-and-wood-sfx'),
    'S1':   ('x_100-CC0-SFX_0', '100 CC0 SFX', 'aijikl', 'https://opengameart.org/content/100-cc0-sfx'),
    'S2':   ('x_sfx_100_v2', '100 CC0 SFX #2', 'geekygnome', 'https://opengameart.org/content/100-cc0-sfx-2'),
    'RPG':  ('x_80-CC0-RPG-SFX_0', '80 CC0 RPG SFX', 'NoirPhantom89', 'https://opengameart.org/content/80-cc0-rpg-sfx'),
    'BRK':  ('x_sfx_breaking_and_falling', '75 CC0 breaking / falling / hit sfx', 'frances', 'https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx'),
    'STEP': ('x_[kdd]DifferentSteps_0', 'Different steps on wood, stone, leaves, gravel and mud', 'qubodup', 'https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud'),
    'SW':   ('x_swishes', 'Swishes Sound Pack', 'qubodup', 'https://opengameart.org/content/swishes-sound-pack'),
    'BIRD': ('x_birdsCrickets', 'Bird, cricket, frog and mosquito sounds', 'OpenGameArt contributor', 'https://opengameart.org/content/birdcricketfrog-and-mosquito-sounds'),
}

def pk(spec):
    """'WM:wood_hit_01' -> path"""
    key, name = spec.split(':')
    base = os.path.join(DL, PACKS[key][0])
    hits = [p for p in glob.glob(glob.escape(base) + '/**/*', recursive=True) if os.path.isfile(p) and os.path.splitext(os.path.basename(p))[0] == name and not os.path.basename(p).startswith('._')]
    if not hits:
        raise SystemExit('missing ' + spec)
    return hits[0]

def many(key, prefix, ns):
    return [f'{key}:{prefix}{n:02d}' for n in ns]

# name -> (list of specs, max seconds, volume)
SFX = {
    'hex-harvest': {
        'tap': (many('RPG', 'item_wood_', [1, 2, 3]), 0.35, 0.55),
        'drop': (['STEP:mud02', 'STEP:leaves02', 'STEP:wood01'], 0.5, 0.8),
        'merge': (many('RPG', 'item_gem_', [1, 2, 3, 4]), 0.9, 0.7),
        'win': (many('S1', 'bell_', [1, 2, 3]), 1.6, 0.7),
        'golden': (many('RPG', 'spell_', [1, 2]), 1.4, 0.7),
        'lose': (['S1:gong_01', 'S1:gong_02'], 1.6, 0.6),
        'whoosh': ([f'SW:swish-{n}' for n in (1, 2, 3, 4)], 0.45, 0.6),
        'coin': (many('RPG', 'item_coins_', [1, 2, 3, 4]), 0.6, 0.6),
        'err': (many('S2', 'sfx100v2_hit_', [1, 2]), 0.4, 0.5),
        'upgrade': (many('RPG', 'item_misc_', [1, 2, 3]), 0.9, 0.6),
    },
    'sloth-sprint': {
        'tap': (many('RPG', 'wood_', [1, 2, 3]), 0.3, 0.5),
        'whoosh': ([f'SW:swish-{n}' for n in (5, 6, 7, 8)], 0.5, 0.7),
        'land': (['STEP:leaves01', 'STEP:wood02', 'STEP:wood03'], 0.55, 0.85),
        'perfect': (many('RPG', 'item_gem_', [2, 3]), 0.9, 0.65),
        'coin': (many('RPG', 'item_coins_', [1, 2, 3, 4]), 0.5, 0.5),
        'hit': (many('BRK', 'bfh1_hit_', [1, 2, 3, 4]), 0.5, 0.8),
        'jump': ([f'SW:swish-{n}' for n in (9, 10, 11)], 0.4, 0.6),
        'drop': (['STEP:leaves02', 'STEP:mud02'], 0.5, 0.7),
        'win': (many('S1', 'bell_', [2, 3]), 1.6, 0.7),
        'lose': (['S1:gong_01'], 1.6, 0.6),
        'upgrade': (many('RPG', 'item_misc_', [4, 5, 6]), 0.9, 0.6),
        'err': (many('S2', 'sfx100v2_hit_', [2, 3]), 0.4, 0.5),
    },
    'pin-the-tail': {
        'tap': (many('S1', 'switch_', [1, 2]), 0.3, 0.6),
        'whoosh': ([f'SW:swish-{n}' for n in (1, 2, 12)], 0.4, 0.6),
        'shoot': ([f'SW:swish-{n}' for n in (3, 4, 13)], 0.35, 0.6),
        'hit': (many('WM', 'wood_hit_', [1, 2, 3, 4, 5]), 0.5, 0.85),
        'err': (many('WM', 'metal_hit_', [1, 2, 3]), 0.5, 0.8),
        'coin': (many('RPG', 'item_coins_', [1, 2, 3, 4]), 0.6, 0.6),
        'win': (many('S1', 'bell_', [1, 2]), 1.6, 0.7),
        'boss': (['S1:gong_02', 'S1:gong_01'], 1.6, 0.7),
        'lose': (['S1:gong_01'], 1.7, 0.6),
        'boom': (many('WM', 'wood_slam_', [1, 2, 3, 4]), 0.8, 0.85),
        'upgrade': (many('RPG', 'item_gem_', [1, 2, 3]), 0.8, 0.6),
        'pop': (many('S1', 'plop_', [1, 2]), 0.5, 0.8),
    },
    'potion-pour': {
        'tap': (many('S1', 'glass_', [1, 2]), 0.3, 0.45),
        'pick': (many('S2', 'sfx100v2_glass_', [1, 2, 3, 4]), 0.6, 0.7),
        'pour': (many('RPG', 'creature_slime_', [1, 2, 3, 4]), 1.0, 0.6),
        'bell': (['S1:bell_03', 'S1:glass_03'], 1.1, 0.55),
        'seal': (['S2:sfx100v2_lock_open_01', 'S1:key_open_01', 'S1:key_open_02'], 0.7, 0.6),
        'win': (many('S1', 'bell_', [1, 2, 3]), 1.8, 0.7),
        'err': (many('S2', 'sfx100v2_hit_', [1, 3]), 0.4, 0.5),
        'upgrade': (many('RPG', 'item_gem_', [1, 2, 3, 4]), 0.8, 0.55),
        'page': (many('RPG', 'book_', [1, 2, 3, 4]), 0.7, 0.6),
        'whoosh': ([f'SW:swish-{n}' for n in (6, 7, 8)], 0.45, 0.5),
        'coin': (many('RPG', 'item_coins_', [1, 2, 3]), 0.5, 0.5),
        'lose': (['S1:gong_01'], 1.6, 0.6),
    },
    'skyline-snap': {
        'tap': (many('S1', 'switch_', [1, 2]), 0.3, 0.6),
        'whoosh': ([f'SW:swish-{n}' for n in (9, 10, 11, 12)], 0.45, 0.5),
        'land': (many('BRK', 'bfh1_metal_hit_', [1, 2, 3, 4, 5, 6]), 0.7, 0.8),
        'perfect': (['S1:bell_03', 'RPG:item_gem_02', 'RPG:item_gem_03'], 1.0, 0.65),
        'drop': (many('BRK', 'bfh1_hit_', [5, 6, 7, 8]), 0.5, 0.7),
        'win': (many('S1', 'bell_', [1, 2, 3]), 1.7, 0.7),
        'lose': (['S1:gong_01', 'S1:gong_02'], 1.7, 0.6),
        'upgrade': (many('RPG', 'item_gem_', [1, 2, 4]), 0.8, 0.6),
        'err': (many('WM', 'metal_close_', [1]), 0.5, 0.6),
        'coin': (many('RPG', 'item_coins_', [1, 2, 3, 4]), 0.5, 0.55),
    },
}

# music: (menu file, play file, title, author/page, trim seconds or None)
MUSIC = {
    'hex-harvest': (('hex-harvest_menu.mp3', 'Cozy Puzzle Title', 'https://opengameart.org/content/cozy-puzzle-title', None), ('hex-harvest_play.mp3', 'Cozy Puzzle In-Game 2', 'https://opengameart.org/content/cozy-puzzle-in-game-2', 120)),
    'sloth-sprint': (('sloth-sprint_menu.mp3', 'Chill Jungle', 'https://opengameart.org/content/chill-jungle', 100), ('sloth-sprint_play.ogg', 'Jungle Sway 2', 'https://opengameart.org/content/jungle-sway-2', None)),
    'pin-the-tail': (('pin-the-tail_menu.ogg', 'Carnival Rides', 'https://opengameart.org/content/carnival-rides', None), ('pin-the-tail_play.wav', 'Rolling Circus', 'https://opengameart.org/content/rolling-circus', None)),
    'potion-pour': (('potion-pour_menu.mp3', 'Magic Puzzle Title', 'https://opengameart.org/content/magic-puzzle-title', 90), ('potion-pour_play.mp3', 'Magic Puzzle In-Game 2', 'https://opengameart.org/content/magic-puzzle-in-game-2', 120)),
    'skyline-snap': (('skyline-snap_menu.ogg', 'Napping on a Cloud', 'https://opengameart.org/content/napping-on-a-cloud', 140), ('skyline-snap_play.mp3', 'happy lofi day', 'https://opengameart.org/content/happy-lofi-day', None)),
}

FONT = {
    'hex-harvest': [('Grandstander', 'grandstander-800', '800'), ('Nunito', 'nunito-800', '800')],
    'sloth-sprint': [('Lilita One', 'lilita-one', '400'), ('Varela Round', 'varela-round', '400')],
    'pin-the-tail': [('Bungee', 'bungee', '400'), ('Bungee Shade', 'bungee-shade', '400')],
    'potion-pour': [('Cinzel Decorative', 'cinzel-decorative-700', '700'), ('Cinzel', 'cinzel-700', '700'), ('Alegreya Sans', 'alegreya-sans-700', '700')],
    'skyline-snap': [('Bebas Neue', 'bebas-neue', '400'), ('DM Sans', 'dmsans-700', '700')],
}
FONT_LICENSE = {'grandstander': 'grandstander', 'nunito': 'nunito', 'lilita': 'lilitaone', 'varela': 'varelaround', 'bungee-shade': 'bungeeshade', 'bungee': 'bungee',
                'cinzel-decorative': 'cinzeldecorative', 'cinzel-700': 'cinzel', 'alegreya': 'alegreyasans', 'bebas': 'bebasneue', 'dmsans': 'dmsans'}


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def sfx_clip(src, dst, maxdur):
    # trim leading silence, cap length, short fade-out, loudness-match, mono mp3
    run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af',
         f'silenceremove=start_periods=1:start_threshold=-48dB,atrim=0:{maxdur},afade=t=out:st={max(0.01, maxdur - 0.08)}:d=0.08,loudnorm=I=-20:TP=-2:LRA=9',
         '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '72k', dst])


def music_clip(src, dst, trim):
    af = 'loudnorm=I=-18:TP=-1.5:LRA=11'
    if trim:
        af = f'atrim=0:{trim},afade=t=out:st={trim - 1.5}:d=1.5,' + af
    run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', af, '-ac', '2', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '88k', dst])


def build(slug):
    gdir = os.path.join(ROOT, 'games', slug); adir = os.path.join(gdir, 'audio'); fdir = os.path.join(gdir, 'fonts')
    shutil.rmtree(adir, ignore_errors=True); shutil.rmtree(fdir, ignore_errors=True)
    os.makedirs(adir); os.makedirs(os.path.join(fdir, 'licenses'))
    man = {'sfx': {}, 'music': None, 'musicMenu': None, 'musicPlay': None, 'fonts': []}
    used_packs = set()
    for name, (specs, maxdur, vol) in SFX[slug].items():
        outs = []
        for i, spec in enumerate(specs):
            out = f'{name}_{i}.mp3'
            sfx_clip(pk(spec), os.path.join(adir, out), maxdur)
            outs.append('audio/' + out); used_packs.add(spec.split(':')[0])
        man['sfx'][name] = {'files': outs, 'vol': vol}
    (mm, mt, mu, mtrim), (pm, pt, pu, ptrim) = MUSIC[slug]
    music_clip(os.path.join(MUS, mm), os.path.join(adir, 'music_menu.mp3'), mtrim)
    music_clip(os.path.join(MUS, pm), os.path.join(adir, 'music_play.mp3'), ptrim)
    man['musicMenu'] = 'audio/music_menu.mp3'; man['musicPlay'] = 'audio/music_play.mp3'; man['music'] = 'audio/music_play.mp3'
    for fam, fname, weight in FONT[slug]:
        shutil.copy(os.path.join(FONTS, fname + '.woff2'), os.path.join(fdir, fname + '.woff2'))
        man['fonts'].append({'family': fam, 'file': 'fonts/' + fname + '.woff2', 'weight': weight})
        lic = next(v for kk, v in FONT_LICENSE.items() if fname.startswith(kk))
        shutil.copy(os.path.join(FONTS, 'licenses', lic + '-OFL.txt'), os.path.join(fdir, 'licenses', lic + '-OFL.txt'))
    with open(os.path.join(gdir, 'assets.js'), 'w') as fh:
        fh.write('window.PG_ASSETS = ' + json.dumps(man, indent=1) + ';\n')
    lines = ['All audio is recorded material released under CC0 1.0 (public domain dedication), sourced from OpenGameArt.org.', '', 'Sound effects:']
    for k in sorted(used_packs):
        _, title, author, url = PACKS[k]
        lines.append(f'  "{title}" by {author}, {url}')
    lines += ['', 'Music:', f'  Menu: "{mt}", {mu}', f'  Gameplay: "{pt}", {pu}', '',
              'Fonts: ' + ', '.join(sorted(set(f[0] for f in FONT[slug]))) + ', SIL Open Font License 1.1 (see fonts/licenses)']
    with open(os.path.join(gdir, 'CREDITS.txt'), 'w') as fh:
        fh.write('\n'.join(lines) + '\n')
    size = sum(os.path.getsize(p) for p in glob.glob(gdir + '/audio/*') + glob.glob(gdir + '/fonts/*.woff2'))
    print(f'{slug}: {len(man["sfx"])} sfx, 2 music, {size / 1024:.0f} KB')


if __name__ == '__main__':
    for s in (sys.argv[1:] or sorted(SFX)):
        build(s)
