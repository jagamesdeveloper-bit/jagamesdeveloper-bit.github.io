#!/usr/bin/env python3
"""Per-game asset pipeline: CC0 sound effects (Kenney), CC0 music (OpenGameArt) and OFL fonts.

Sources are downloaded to /tmp (see SOURCES below) and converted into games/<slug>/audio and
games/<slug>/fonts. A generated games/<slug>/assets.js describes them for shared/pg.js.

usage: assets.py [slug ...]
"""
import os, sys, json, glob, subprocess, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEN = '/tmp/kenney/x'
MUS = '/tmp/music'
FONTS = os.path.join(ROOT, 'shared', 'fonts')

SOURCES = {
    'kenney': 'https://kenney.nl/assets/{interface-sounds,impact-sounds,casino-audio,digital-audio,rpg-audio,music-jingles,ui-audio,sci-fi-sounds} (CC0)',
    'music': 'https://opengameart.org/content/<slug> (CC0), see MUSIC below',
    'fonts': 'Google Fonts, SIL Open Font License (shared/fonts/licenses)',
}

def k(name):
    """find a Kenney file by basename"""
    hits = glob.glob(f'{KEN}/**/{name}.ogg', recursive=True)
    if not hits:
        raise SystemExit('missing kenney sound ' + name)
    return hits[0]

def r(prefix, n=5, start=0):
    return [f'{prefix}_{i:03d}' for i in range(start, start + n)]

# music: (file in /tmp/music, OpenGameArt slug, author, trim seconds or None)
MUSIC = {
    'hex-harvest': ('hex_flowerbed.ogg', 'flowerbed-fields-loop', 'Zane Little Music', None),
    'sloth-sprint': ('sloth_jungle_chill.ogg', 'i-think-id-stay-jungle-chill', 'emmntt', None),
    'pin-the-tail': ('pin_circus.mp3', 'taking-you-to-the-circus', 'Pro Sensory', 116.0),
    'potion-pour': ('potion_magic.mp3', 'magic-puzzle-in-game-1', 'mintodog', None),
    'tower-of-toast': ('toast_goofy.mp3', 'goofy-attitude', 'SkyleTheFrench', 98.0),
    'cat-cannon-golf': ('golf_greenhills.mp3', 'green-hills', 'Igor Gundarev', None),
    'bounce-brigade': ('bounce_cyber.ogg', 'cyber-runner-music', 'ansimuz', None),
    'dino-dig': ('dino_summer.mp3', 'summer-park-8bit-tune-loop', 'scribe', None),
    'jelly-jam': ('jelly_candy.mp3', 'candy-day', 'haruta', 92.6),
    'skyline-snap': ('sky_lofi.ogg', 'chill-lofi-inspired-loop-edit', 'qubodup', None),
    'ghost-grocer': ('ghost_hulla.mp3', 'halloween-hullabaloo', 'starlightfrost', None),
}

# fonts: list of (family, file, weight)
FONT = {
    'hex-harvest': [('Grandstander', 'grandstander-800', '800'), ('Nunito', 'nunito-800', '800')],
    'sloth-sprint': [('Lilita One', 'lilita-one', '400'), ('Varela Round', 'varela-round', '400')],
    'pin-the-tail': [('Bungee', 'bungee', '400'), ('Bungee Shade', 'bungee-shade', '400')],
    'potion-pour': [('Cinzel Decorative', 'cinzel-decorative-700', '700'), ('Cinzel', 'cinzel-700', '700'), ('Alegreya Sans', 'alegreya-sans-700', '700')],
    'tower-of-toast': [('Titan One', 'titan-one', '400'), ('Nunito', 'nunito-800', '800')],
    'cat-cannon-golf': [('Fredoka', 'fredoka-600', '600')],
    'bounce-brigade': [('Orbitron', 'orbitron-800', '800'), ('Rajdhani', 'rajdhani-700', '700')],
    'dino-dig': [('Pixelify Sans', 'pixelify-700', '700'), ('Pixelify Sans', 'pixelify-500', '500')],
    'jelly-jam': [('Baloo 2', 'baloo2-800', '800')],
    'skyline-snap': [('Bebas Neue', 'bebas-neue', '400'), ('DM Sans', 'dmsans-700', '700')],
    'ghost-grocer': [('Creepster', 'creepster', '400'), ('Patrick Hand', 'patrick-hand', '400')],
}
FONT_LICENSE = {'grandstander': 'grandstander', 'nunito': 'nunito', 'lilita': 'lilitaone', 'varela': 'varelaround', 'bungee-shade': 'bungeeshade', 'bungee': 'bungee',
                'cinzel-decorative': 'cinzeldecorative', 'cinzel-700': 'cinzel', 'alegreya': 'alegreyasans', 'titan': 'titanone', 'fredoka': 'fredoka', 'orbitron': 'orbitron',
                'rajdhani': 'rajdhani', 'pixelify': 'pixelifysans', 'baloo2': 'baloo2', 'bebas': 'bebasneue', 'dmsans': 'dmsans', 'patrick': 'patrickhand', 'creepster': 'creepster'}

UP_LONG, UP_SHORT, DOWN = '02', '16', '01'
def jingle(kind, idx):
    return {'nes': 'jingles_NES', 'pizzi': 'jingles_PIZZI', 'sax': 'jingles_SAX', 'steel': 'jingles_STEEL', 'hit': 'jingles_HIT'}[kind] + idx

# sound maps: name -> ([kenney basenames], volume)
SFX = {
    'hex-harvest': {
        'tap': (['select_002', 'select_003'], 0.5), 'drop': (r('footstep_grass'), 0.9), 'merge': (['pluck_001', 'pluck_002'], 0.8),
        'win': ([jingle('pizzi', '02')], 0.7), 'golden': ([jingle('pizzi', '15')], 0.8), 'lose': ([jingle('pizzi', '01')], 0.7),
        'whoosh': (['cloth1', 'cloth2'], 0.7), 'coin': (['glass_002', 'glass_004'], 0.6), 'err': (['error_004'], 0.5), 'upgrade': (['confirmation_002'], 0.6),
    },
    'sloth-sprint': {
        'tap': (['click_002'], 0.5), 'whoosh': (['cloth1', 'cloth2', 'cloth3', 'cloth4'], 0.8), 'land': (r('impactWood_light'), 0.8),
        'perfect': (['confirmation_001'], 0.6), 'coin': (['glass_001', 'glass_003', 'glass_005'], 0.45), 'hit': (r('impactPunch_medium'), 0.8),
        'jump': (['maximize_002'], 0.5), 'win': ([jingle('steel', '12')], 0.7), 'lose': ([jingle('steel', '01')], 0.7), 'upgrade': (['confirmation_003'], 0.6), 'err': (['error_003'], 0.5),
    },
    'pin-the-tail': {
        'tap': (['card-place-1', 'card-place-2', 'card-place-3'], 0.7), 'shoot': (['knifeSlice', 'knifeSlice2', 'drawKnife1', 'drawKnife2'], 0.55),
        'hit': (r('impactWood_medium'), 0.85), 'err': (r('impactMetal_light'), 0.9), 'coin': (['chips-stack-1', 'chips-stack-2', 'chips-stack-3'], 0.8),
        'win': ([jingle('sax', '15')], 0.75), 'boss': ([jingle('sax', '02')], 0.8), 'lose': ([jingle('sax', '01')], 0.75), 'boom': (r('impactPlank_medium'), 0.9),
        'upgrade': (['chips-handle-1', 'chips-handle-2'], 0.8), 'pop': (r('impactPunch_heavy'), 0.8),
    },
    'potion-pour': {
        'tap': (['click_004'], 0.45), 'pick': (r('impactGlass_light'), 0.7), 'pour': (['slime_000', 'slime_001'], 0.6), 'bell': (['glass_003', 'glass_006'], 0.55),
        'seal': (['confirmation_004'], 0.55), 'win': ([jingle('steel', '12')], 0.75), 'err': (['error_006'], 0.5), 'upgrade': (['maximize_004'], 0.5), 'page': (['bookFlip1', 'bookFlip2', 'bookFlip3'], 0.6),
    },
    'tower-of-toast': {
        'tap': (['click1', 'click2', 'click3'], 0.6), 'shoot': (['metalClick'], 0.45), 'drop': (['slime_000', 'slime_001'], 0.45), 'pop': (r('impactSoft_medium'), 0.7),
        'hit': (['chop'], 0.8), 'bell': (['impactBell_heavy_000', 'impactBell_heavy_001'], 0.35), 'coin': (['handleCoins', 'handleCoins2'], 0.6),
        'upgrade': (r('impactWood_heavy', 3), 0.7), 'win': ([jingle('hit', '15')], 0.75), 'lose': ([jingle('pizzi', '01')], 0.75), 'boom': (r('impactPlate_heavy', 3), 0.8), 'err': (['error_001'], 0.5),
    },
    'cat-cannon-golf': {
        'tap': (['click_001'], 0.5), 'boom': (r('impactWood_light'), 0.9), 'hit': (r('footstep_grass'), 0.8), 'pop': (['pluck_001', 'pluck_002'], 0.8),
        'drop': (r('impactTin_medium', 3), 0.85), 'win': ([jingle('pizzi', '02')], 0.75), 'ace': ([jingle('sax', '02')], 0.8), 'err': (['error_002'], 0.5), 'merge': (['select_004'], 0.6),
    },
    'bounce-brigade': {
        'tap': (['twoTone1'], 0.4), 'hit': (r('impactMetal', 5), 0.35), 'pop': (['spaceTrash1', 'spaceTrash2', 'spaceTrash3', 'spaceTrash4', 'spaceTrash5'], 0.35),
        'boom': (['lowFrequency_explosion_000', 'lowFrequency_explosion_001'], 0.7), 'shoot': (['zap1', 'zap2'], 0.35), 'upgrade': (['powerUp2', 'powerUp5'], 0.5),
        'win': ([jingle('nes', '02')], 0.7), 'lose': ([jingle('nes', '01')], 0.7), 'coin': (['pepSound1', 'pepSound2', 'pepSound3'], 0.25), 'land': (r('forceField'), 0.4), 'err': (['lowDown'], 0.5),
    },
    'dino-dig': {
        'tap': (['tone1'], 0.35), 'hit': (r('impactMining'), 0.55), 'pop': (r('footstep_concrete'), 0.8), 'coin': (['pepSound1', 'pepSound4'], 0.25),
        'bell': ([jingle('nes', '16')], 0.6), 'win': ([jingle('nes', '02')], 0.7), 'upgrade': (['powerUp2', 'powerUp7'], 0.45), 'boom': (r('explosionCrunch'), 0.7), 'err': (['lowDown'], 0.45),
    },
    'jelly-jam': {
        'tap': (['click_005'], 0.5), 'drop': (r('impactSoft_medium'), 0.9), 'merge': (['maximize_006', 'maximize_007'], 0.6), 'win': ([jingle('pizzi', '16')], 0.75),
        'lose': ([jingle('pizzi', '14')], 0.7), 'pop': (['select_003'], 0.5), 'rotate': (['switch_002', 'switch_003'], 0.6), 'coin': (['glass_001'], 0.5),
        'err': (['error_005'], 0.5), 'perfect': ([jingle('pizzi', '04')], 0.7), 'upgrade': (['confirmation_001'], 0.6),
    },
    'skyline-snap': {
        'tap': (['click2', 'click4'], 0.6), 'whoosh': (['minimize_003', 'minimize_005'], 0.45), 'land': (r('impactWood_heavy'), 0.8), 'perfect': (['glass_006'], 0.6),
        'drop': (r('footstep_concrete'), 0.7), 'win': ([jingle('sax', '15')], 0.75), 'lose': ([jingle('sax', '01')], 0.75), 'upgrade': (['confirmation_003'], 0.6), 'err': (['error_007'], 0.5),
    },
    'ghost-grocer': {
        'tap': (['click_002'], 0.5), 'pop': (['handleSmallLeather', 'handleSmallLeather2', 'beltHandle1'], 0.8), 'coin': (['handleCoins', 'handleCoins2'], 0.7),
        'bell': (['bong_001'], 0.6), 'ghost': (['creak1', 'creak2', 'creak3'], 0.6), 'boom': (['doorClose_1', 'doorClose_2', 'doorClose_4'], 0.7),
        'hit': (r('impactSoft_heavy'), 0.8), 'win': ([jingle('pizzi', '02')], 0.75), 'lose': ([jingle('pizzi', '01')], 0.75), 'whoosh': (['cloth3', 'cloth4'], 0.7),
        'merge': (['bookPlace1', 'bookPlace2', 'bookPlace3'], 0.6), 'err': (['error_008'], 0.5), 'upgrade': (['confirmation_002'], 0.6),
    },
}

def L(*layers):
    """layered sound: each layer is (kenney basename, delay seconds, gain, semitones)"""
    return ('layers', layers)

def conv_layers(layers, dst):
    """mix several Kenney sounds (delay/gain/pitch per layer) into one mp3"""
    cmd = ['ffmpeg', '-v', 'error', '-y']
    flt = []
    for i, (name, delay, gain, st) in enumerate(layers):
        cmd += ['-i', k(name)]
        f = f'[{i}:a]aresample=44100,silenceremove=start_periods=1:start_threshold=-50dB'
        if st:
            f += f',asetrate={int(44100 * 2 ** (st / 12.0))},aresample=44100'
        f += f',volume={gain},adelay={int(delay * 1000)}|{int(delay * 1000)}[l{i}]'
        flt.append(f)
    mix = ''.join(f'[l{i}]' for i in range(len(layers)))
    flt.append(f'{mix}amix=inputs={len(layers)}:normalize=0,alimiter=limit=0.95[o]')
    cmd += ['-filter_complex', ';'.join(flt), '-map', '[o]', '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '80k', dst]
    subprocess.run(cmd, check=True)


# v1.3 sound design: layered, pitched Kenney recordings (human made, CC0) for the five flagship games
SFX['hex-harvest'] = {
    'tap': ([L(('impactSoft_medium_000', 0, 0.9, 5), ('pluck_001', 0.012, 0.35, 0)), L(('impactSoft_medium_001', 0, 0.9, 6), ('pluck_002', 0.012, 0.35, 0))], 0.55),
    'drop': ([L(('footstep_grass_000', 0, 0.9, -2), ('impactSoft_heavy_000', 0.015, 0.6, -4)), L(('footstep_grass_002', 0, 0.9, -1), ('impactSoft_heavy_001', 0.015, 0.6, -5)), L(('footstep_grass_004', 0, 0.9, -3), ('impactSoft_heavy_002', 0.015, 0.6, -4))], 0.9),
    'merge': ([L(('pluck_001', 0, 0.9, 0), ('pluck_002', 0.07, 0.8, 4), ('glass_002', 0.14, 0.45, 7)), L(('pluck_002', 0, 0.9, 2), ('pluck_001', 0.07, 0.8, 7), ('glass_004', 0.14, 0.45, 9))], 0.8),
    'win': ([L((jingle('pizzi', '02'), 0, 0.9, 0), ('glass_002', 0.2, 0.35, 7))], 0.7),
    'golden': ([L((jingle('pizzi', '15'), 0, 0.9, 0), ('glass_004', 0.1, 0.4, 9), ('glass_006', 0.3, 0.3, 12))], 0.8),
    'lose': ([L((jingle('pizzi', '01'), 0, 0.9, -2))], 0.7),
    'whoosh': ([L(('cloth1', 0, 0.9, 0), ('footstep_grass_001', 0.12, 0.35, 3)), L(('cloth2', 0, 0.9, 1))], 0.7),
    'coin': ([L(('glass_002', 0, 0.8, 3), ('pluck_001', 0.02, 0.3, 12)), L(('glass_004', 0, 0.8, 2), ('pluck_002', 0.02, 0.3, 12))], 0.6),
    'err': ([L(('impactWood_light_000', 0, 0.9, -6), ('error_004', 0.0, 0.25, -3))], 0.5),
    'upgrade': ([L(('confirmation_002', 0, 0.8, 0), ('pluck_001', 0.1, 0.5, 7), ('pluck_002', 0.18, 0.5, 12))], 0.6),
}
SFX['sloth-sprint'] = {
    'tap': ([L(('impactWood_light_000', 0, 0.7, 3), ('click_002', 0, 0.3, 0))], 0.5),
    'whoosh': ([L(('cloth1', 0, 0.9, -2), ('cloth3', 0.04, 0.4, 3)), L(('cloth2', 0, 0.9, -1), ('cloth4', 0.05, 0.4, 2)), L(('cloth3', 0, 0.9, -3))], 0.8),
    'land': ([L(('impactWood_light_000', 0, 0.9, -2), ('footstep_grass_000', 0.02, 0.5, -3)), L(('impactWood_light_002', 0, 0.9, -1), ('footstep_grass_003', 0.02, 0.5, -2)), L(('impactWood_medium_001', 0, 0.8, 0), ('footstep_grass_001', 0.02, 0.5, -3))], 0.8),
    'perfect': ([L(('glass_006', 0, 0.8, 2), ('confirmation_001', 0, 0.45, 5), ('pluck_002', 0.1, 0.5, 12))], 0.6),
    'coin': ([L(('glass_001', 0, 0.8, 5), ('pluck_001', 0.015, 0.4, 14)), L(('glass_003', 0, 0.8, 4), ('pluck_002', 0.015, 0.4, 14)), L(('glass_005', 0, 0.8, 6), ('pluck_001', 0.015, 0.4, 16))], 0.4),
    'hit': ([L(('impactPunch_medium_000', 0, 0.9, -2), ('impactSoft_heavy_000', 0.01, 0.7, -3)), L(('impactPunch_medium_002', 0, 0.9, -1), ('impactSoft_heavy_002', 0.01, 0.7, -4))], 0.8),
    'jump': ([L(('cloth2', 0, 0.8, 5), ('maximize_002', 0.03, 0.35, 0))], 0.5),
    'win': ([L((jingle('steel', '12'), 0, 0.9, 0), ('glass_003', 0.3, 0.3, 7))], 0.7),
    'lose': ([L((jingle('steel', '01'), 0, 0.9, -2))], 0.7),
    'upgrade': ([L(('confirmation_003', 0, 0.8, 0), ('pluck_001', 0.1, 0.5, 7), ('pluck_002', 0.17, 0.5, 12))], 0.6),
    'err': ([L(('impactWood_medium_000', 0, 0.9, -7), ('error_003', 0, 0.2, -4))], 0.5),
}
SFX['pin-the-tail'] = {
    'tap': ([L(('card-place-1', 0, 0.8, 0), ('click_002', 0, 0.25, 4)), L(('card-place-2', 0, 0.8, 1)), L(('card-place-3', 0, 0.8, -1))], 0.7),
    'shoot': ([L(('knifeSlice', 0, 0.9, 2), ('cloth1', 0, 0.35, 3)), L(('knifeSlice2', 0, 0.9, 1), ('cloth2', 0, 0.35, 2)), L(('drawKnife1', 0, 0.8, 3), ('cloth3', 0, 0.3, 2))], 0.55),
    'hit': ([L(('impactWood_medium_000', 0, 0.9, -1), ('chop', 0.0, 0.5, 2), ('impactMetal_light_000', 0.02, 0.2, 6)), L(('impactWood_medium_002', 0, 0.9, 0), ('chop', 0.0, 0.5, 3), ('impactMetal_light_001', 0.02, 0.2, 7)), L(('impactWood_medium_004', 0, 0.9, -2), ('chop', 0.0, 0.5, 1), ('impactMetal_light_002', 0.02, 0.2, 5))], 0.85),
    'err': ([L(('impactMetal_light_000', 0, 0.9, -2), ('impactPlate_light_000', 0.02, 0.5, -3)), L(('impactMetal_light_002', 0, 0.9, -1), ('impactPlate_light_001', 0.02, 0.5, -3))], 0.9),
    'coin': ([L(('chips-stack-1', 0, 0.9, 0), ('glass_002', 0.03, 0.3, 8)), L(('chips-stack-2', 0, 0.9, 1)), L(('chips-stack-3', 0, 0.9, -1), ('glass_004', 0.03, 0.3, 8))], 0.8),
    'win': ([L((jingle('sax', '15'), 0, 0.9, 0), ('chips-handle-1', 0.25, 0.4, 0))], 0.75),
    'boss': ([L((jingle('sax', '02'), 0, 0.9, 0), ('impactPlank_medium_000', 0.0, 0.6, -5))], 0.8),
    'lose': ([L((jingle('sax', '01'), 0, 0.9, -2))], 0.75),
    'boom': ([L(('impactPlank_medium_000', 0, 0.9, -3), ('impactWood_heavy_000', 0.01, 0.8, -4), ('impactPlate_heavy_000', 0.03, 0.4, -6)), L(('impactPlank_medium_002', 0, 0.9, -2), ('impactWood_heavy_002', 0.01, 0.8, -5), ('impactPlate_heavy_001', 0.03, 0.4, -6))], 0.9),
    'upgrade': ([L(('chips-handle-1', 0, 0.9, 0), ('glass_004', 0.08, 0.35, 7), ('confirmation_002', 0.05, 0.3, 4)), L(('chips-handle-2', 0, 0.9, 1), ('glass_006', 0.08, 0.35, 7))], 0.8),
    'pop': ([L(('impactPunch_heavy_000', 0, 0.8, 4), ('select_003', 0.0, 0.4, 5)), L(('impactPunch_heavy_002', 0, 0.8, 5), ('select_002', 0.0, 0.4, 5))], 0.8),
}
SFX['potion-pour'] = {
    'tap': ([L(('impactGlass_light_000', 0, 0.5, 5), ('click_004', 0, 0.4, 0))], 0.45),
    'pick': ([L(('impactGlass_light_000', 0, 0.9, 1), ('impactGlass_light_002', 0.05, 0.4, 5)), L(('impactGlass_light_001', 0, 0.9, 2), ('impactGlass_light_003', 0.05, 0.4, 6)), L(('impactGlass_light_004', 0, 0.9, 0), ('impactGlass_light_001', 0.05, 0.4, 4))], 0.7),
    'pour': ([L(('slime_000', 0, 0.9, 3), ('slime_001', 0.12, 0.6, 5), ('impactGlass_light_001', 0.3, 0.25, 9)), L(('slime_001', 0, 0.9, 2), ('slime_000', 0.12, 0.6, 4), ('impactGlass_light_003', 0.3, 0.25, 8))], 0.6),
    'bell': ([L(('glass_003', 0, 0.9, 0), ('impactBell_heavy_000', 0, 0.2, 14)), L(('glass_006', 0, 0.9, 2), ('impactBell_heavy_001', 0, 0.2, 12))], 0.55),
    'seal': ([L(('confirmation_004', 0, 0.8, -2), ('glass_006', 0.08, 0.5, 5), ('bookClose', 0.0, 0.5, 0))], 0.6),
    'win': ([L((jingle('steel', '12'), 0, 0.9, 0), ('glass_003', 0.4, 0.4, 5), ('glass_006', 0.55, 0.3, 9))], 0.75),
    'err': ([L(('impactWood_medium_001', 0, 0.8, -5), ('error_006', 0, 0.3, -2))], 0.5),
    'upgrade': ([L(('maximize_004', 0, 0.7, 0), ('glass_003', 0.1, 0.45, 7), ('glass_006', 0.18, 0.4, 12))], 0.5),
    'page': ([L(('bookFlip1', 0, 0.9, 0), ('cloth1', 0.0, 0.2, 0)), L(('bookFlip2', 0, 0.9, 0)), L(('bookFlip3', 0, 0.9, 0))], 0.6),
}
SFX['skyline-snap'] = {
    'tap': ([L(('click2', 0, 0.8, -2), ('impactMetal_light_000', 0, 0.3, 2)), L(('click4', 0, 0.8, -2), ('impactMetal_light_001', 0, 0.3, 3))], 0.6),
    'whoosh': ([L(('minimize_003', 0, 0.7, -2), ('cloth1', 0, 0.3, 0)), L(('minimize_005', 0, 0.7, -2), ('cloth2', 0, 0.3, 0))], 0.45),
    'land': ([L(('impactWood_heavy_000', 0, 0.9, -2), ('impactPlate_light_000', 0.02, 0.5, -2), ('footstep_concrete_000', 0.03, 0.4, -4)), L(('impactWood_heavy_002', 0, 0.9, -1), ('impactPlate_light_002', 0.02, 0.5, -3), ('footstep_concrete_002', 0.03, 0.4, -3)), L(('impactWood_heavy_004', 0, 0.9, -3), ('impactPlate_medium_000', 0.02, 0.5, -3))], 0.8),
    'perfect': ([L(('glass_006', 0, 0.8, 0), ('impactBell_heavy_000', 0, 0.25, 12), ('confirmation_001', 0.05, 0.4, 7))], 0.6),
    'drop': ([L(('footstep_concrete_000', 0, 0.9, -2), ('impactSoft_heavy_000', 0.01, 0.5, -4)), L(('footstep_concrete_002', 0, 0.9, -1), ('impactSoft_heavy_002', 0.01, 0.5, -3))], 0.7),
    'win': ([L((jingle('sax', '15'), 0, 0.9, 0), ('impactBell_heavy_000', 0.0, 0.3, 7))], 0.75),
    'lose': ([L((jingle('sax', '01'), 0, 0.9, -2), ('impactPlank_medium_000', 0.2, 0.4, -6))], 0.75),
    'upgrade': ([L(('confirmation_003', 0, 0.8, 0), ('glass_006', 0.1, 0.35, 7), ('glass_003', 0.18, 0.3, 12))], 0.6),
    'err': ([L(('impactMetal_medium_000', 0, 0.8, -6), ('error_007', 0, 0.25, -3))], 0.5),
}

def conv(src, dst, extra=None, mono=True, br='80k'):
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', src]
    if extra:
        cmd += extra
    cmd += ['-ac', '1' if mono else '2', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', br, dst]
    subprocess.run(cmd, check=True)

def build(slug):
    gdir = os.path.join(ROOT, 'games', slug); adir = os.path.join(gdir, 'audio'); fdir = os.path.join(gdir, 'fonts')
    shutil.rmtree(adir, ignore_errors=True); shutil.rmtree(fdir, ignore_errors=True); os.makedirs(adir); os.makedirs(os.path.join(fdir, 'licenses'))
    manifest = {'sfx': {}, 'music': None, 'fonts': []}
    for name, (files, vol) in SFX[slug].items():
        outs = []
        for i, f in enumerate(files):
            out = f'{name}_{i}.mp3'
            if isinstance(f, tuple) and f[0] == 'layers':
                conv_layers(f[1], os.path.join(adir, out))
            else:
                conv(k(f), os.path.join(adir, out), ['-af', 'silenceremove=start_periods=1:start_threshold=-50dB'])
            outs.append('audio/' + out)
        manifest['sfx'][name] = {'files': outs, 'vol': vol}
    mf, mslug, author, trim = MUSIC[slug]
    extra = (['-t', str(trim)] if trim else []) + ['-af', 'loudnorm=I=-17:TP=-1.5:LRA=11']
    conv(os.path.join(MUS, mf), os.path.join(adir, 'music.mp3'), extra, mono=False, br='96k')
    manifest['music'] = 'audio/music.mp3'
    for fam, fname, weight in FONT[slug]:
        shutil.copy(os.path.join(FONTS, fname + '.woff2'), os.path.join(fdir, fname + '.woff2'))
        manifest['fonts'].append({'family': fam, 'file': 'fonts/' + fname + '.woff2', 'weight': weight})
        lic = next(v for kk, v in FONT_LICENSE.items() if fname.startswith(kk))
        shutil.copy(os.path.join(FONTS, 'licenses', lic + '-OFL.txt'), os.path.join(fdir, 'licenses', lic + '-OFL.txt'))
    with open(os.path.join(gdir, 'assets.js'), 'w') as fh:
        fh.write('window.PG_ASSETS = ' + json.dumps(manifest, indent=1) + ';\n')
    credits = ['Sound effects: Kenney (www.kenney.nl), CC0 1.0', f'Music: "{mslug}" by {author}, https://opengameart.org/content/{mslug}, CC0 1.0',
               'Fonts: ' + ', '.join(sorted(set(f[0] for f in FONT[slug]))) + ', SIL Open Font License 1.1 (see fonts/licenses)']
    with open(os.path.join(gdir, 'CREDITS.txt'), 'w') as fh:
        fh.write('\n'.join(credits) + '\n')
    size = sum(os.path.getsize(p) for p in glob.glob(gdir + '/audio/*') + glob.glob(gdir + '/fonts/*.woff2'))
    print(f'{slug}: {len(manifest["sfx"])} sfx, music, {len(FONT[slug])} fonts, {size/1024:.0f} KB')

if __name__ == '__main__':
    for s in (sys.argv[1:] or sorted(SFX)):
        build(s)
