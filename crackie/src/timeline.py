"""Zentrale Zeitleiste von „Crackie: The Living Mirror“.

Alle Zeiten in Sekunden. Animation (Blender), Stimme (TTS), Sounddesign und
Nachbearbeitung lesen dieselben Werte, damit Bild, Ton und Untertitel exakt
synchron bleiben.
"""

FPS = 24
DURATION = 120.0
FRAMES = int(FPS * DURATION)          # 2880
WIDTH, HEIGHT = 1080, 1920

def f(t):
    """Sekunden -> Blender-Frame (Frame 1 = 0,0 s)."""
    return int(round(t * FPS)) + 1

TITLE = "WAS WÄRE, WENN DEIN SPIEGELBILD PLÖTZLICH LEBENDIG WIRD?"

SCENES = [
    # nr, start, ende, Titel
    (1, 0.0, 12.0, "DER ERSTE FEHLER"),
    (2, 12.0, 27.0, "ETWAS STIMMT NICHT"),
    (3, 27.0, 42.0, "DER DOPPELGÄNGER LACHT"),
    (4, 42.0, 58.0, "DER SPIEGEL ÖFFNET SICH"),
    (5, 58.0, 75.0, "CRACKIES DOPPELGÄNGER"),
    (6, 75.0, 94.0, "DER KAMPF"),
    (7, 94.0, 110.0, "DIE ÜBERRASCHUNG"),
    (8, 110.0, 120.0, "DER LETZTE TWIST"),
]

# Sprecher (tief, geheimnisvoll) und Figuren. who: erzaehler | crackie | dunkel
# style: Sprecher der Piper-Stimme thorsten_emotional (amused, neutral, sleepy, whisper …)
LINES = [
    dict(id="s1_vo", who="erzaehler", t=3.0, text="Was wäre, wenn dein Spiegelbild plötzlich aufhört, dich zu imitieren?"),
    dict(id="s1_c", who="crackie", style="sleepy", t=9.7, text="Hab ich zu wenig geschlafen?"),
    dict(id="s2_vo", who="erzaehler", t=12.8, text="Zuerst denkst du, du bist einfach müde. Doch dann beginnt dein Spiegelbild, Dinge zu tun, die du niemals getan hast."),
    dict(id="s2_c", who="crackie", style="neutral", t=24.0, text="Äh. Hallo? Ich bin das Original."),
    dict(id="s3_vo", who="erzaehler", t=28.0, text="Und plötzlich merkst du: Da ist jemand auf der anderen Seite. Und er findet dich ziemlich lustig."),
    dict(id="s3_c", who="crackie", style="sleepy", t=34.4, text="Sehr witzig. Wirklich."),
    dict(id="s4_vo", who="erzaehler", t=42.6, text="Doch dann passiert das Unmögliche. Der Spiegel wird zu einer Tür."),
    dict(id="s4_c", who="crackie", style="neutral", t=51.8, text="Nee. Nee, nee, nee, nee."),
    dict(id="s5_vo", who="erzaehler", t=62.4, text="Und vor dir steht plötzlich jemand, der genauso aussieht wie du. Dieselbe Stimme. Dasselbe Gesicht. Aber eine ganz andere Persönlichkeit."),
    dict(id="s5_d", who="dunkel", style="whisper", t=70.2, text="Hallo, Crackie."),
    dict(id="s5_c", who="crackie", style="sleepy", t=72.2, text="Keine Zeit für mich selbst."),
    dict(id="s6_c1", who="crackie", style="angry", t=75.1, text="Zurück in den Spiegel, Kopie!"),
    dict(id="s6_vo", who="erzaehler", t=77.6, text="Crackie versucht, sein Spiegelbild loszuwerden. Doch leider ist sein Gegner genauso faul wie er, und kennt jeden seiner Tricks."),
    dict(id="s6_c2", who="crackie", style="neutral", t=90.2, text="Aua. Mein Zahn!"),
    dict(id="s7_c", who="crackie", style="amused", t=95.0, text="Legende bleibt Legende."),
    dict(id="s7_vo", who="erzaehler", t=100.6, text="Doch Crackie hat ein kleines Problem übersehen. Der Spiegel war nicht die einzige Möglichkeit, ihn zu verlassen."),
    dict(id="s8_vo", who="erzaehler", t=116.1, text="Würdest du deinem Spiegelbild noch vertrauen?"),
    dict(id="s8_laugh", who="crackie", style="amused", t=118.6, text="Hehehehe. Hehe. Hehehe."),
]

# Wichtige Momente (für Animation, Sound und Effekte)
EV = dict(
    open_glitch=0.0,
    hook_eye_flick=0.6,
    raise_hand=3.0, lower_hand=4.6, refl_smile=4.2,
    look_back=7.6, wink=9.0, freeze=9.3,
    head_turn=12.6, brows_up=14.3, point_self=17.6, refl_point=19.2, refl_grin=20.4, step_back=23.4,
    cross_arms=27.3, refl_laugh=29.4, grimace=32.4, finger=35.2, finger_end=37.4, laugh_harder=35.8,
    serious=38.6, eyes_glow=39.2,
    vibrate=42.2, particles=43.2, liquid=46.0, hand_glass=48.3, crack=50.4, step_back2=51.0, breakthrough=54.0, hand_out=56.0,
    step_out=58.3, land=61.4, face_off=62.5, hood_back=66.4, dark_grin=67.6, mimic=69.6,
    lunge=75.0, sidestep=77.3, slide=78.4, bottles=79.4, jump_sink=80.2, towel=82.9, towel_hit=83.6,
    double_slide=84.8, collide=86.0, windup=86.8, duck=88.3, frame_hit=89.0, chunk_fall=91.0, bonk=91.6, ko=92.3,
    proud=94.4, turn_around=98.2, empty=99.0, laugh_behind=101.0, push_in=101.6, eyes_wide=102.8,
    look_down=103.6, shadow_move=104.4, turn_mirror=110.4, dark_in_mirror=112.4, dark_raise=113.6,
    lights_out=115.6, end_text=116.0, end_logo=118.4,
)
