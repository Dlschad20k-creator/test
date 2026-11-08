"""Posen- und Mimik-Bibliothek (Werte für CharAnim.pose)."""

# Körper
CHILL = {'torso': (3.0, 0.0, 0.0), 'arm_L': (4.0, 7.0, 0.0), 'arm_R': (4.0, 7.0, 0.0), 'fore_L': 14.0, 'fore_R': 14.0,
         'leg_L': (0.0, 2.0, 4.0), 'leg_R': (0.0, 2.0, 4.0), 'shin_L': 0.0, 'shin_R': 0.0,
         'hips.loc': (0.0, 0.0, 0.0), 'hips.rot': (0.0, 0.0, 0.0), 'hand_L': 'relaxed', 'hand_R': 'relaxed'}
SLOUCH = dict(CHILL, **{'torso': (8.0, 0.0, 0.0), 'head': (6.0, 2.0, 0.0), 'hips.rot': (0.0, 2.0, 0.0),
                        'arm_L': (8.0, 5.0, 0.0), 'arm_R': (8.0, 5.0, 0.0), 'fore_L': 20.0, 'fore_R': 20.0})
SCRATCH_HEAD_R = {'arm_R': (40.0, 70.0, 90.0), 'fore_R': 125.0, 'hand_R': 'relaxed', 'head': (4.0, -8.0, 0.0)}
WAVE_R = {'arm_R': (10.0, 78.0, 90.0), 'fore_R': 95.0, 'hand_R': 'open'}
CROSS = {'arm_L': (28.0, 4.0, -78.0), 'fore_L': 105.0, 'arm_R': (36.0, 4.0, -78.0), 'fore_R': 100.0,
         'hand_L': 'fist', 'hand_R': 'fist', 'torso': (-2.0, 0.0, 0.0)}
POINT_SELF_R = {'arm_R': (30.0, -4.0, -88.0), 'fore_R': 125.0, 'hand_R': 'point', 'head': (12.0, 0.0, 0.0)}
POINT_FWD_R = {'arm_R': (80.0, 4.0, 0.0), 'fore_R': 8.0, 'hand_R': 'point'}
FINGER_R = {'arm_R': (55.0, 10.0, -10.0), 'fore_R': 100.0, 'hand_R': 'finger'}
PALM_UP_R = {'arm_R': (80.0, 6.0, 0.0), 'fore_R': 92.0, 'hand_R': 'open'}
PALM_UP_L = {'arm_L': (80.0, 6.0, 0.0), 'fore_L': 92.0, 'hand_L': 'open'}
HANDS_UP = dict(PALM_UP_R, **PALM_UP_L)
FIGHT = {'arm_L': (45.0, 6.0, -35.0), 'fore_L': 115.0, 'arm_R': (35.0, 6.0, -35.0), 'fore_R': 120.0,
         'hand_L': 'fist', 'hand_R': 'fist', 'torso': (10.0, 0.0, 8.0),
         'leg_L': (14.0, 8.0, 6.0), 'leg_R': (-12.0, 8.0, 6.0), 'shin_L': 12.0, 'shin_R': 16.0,
         'hips.loc': (0.0, 0.0, -0.035)}
PUNCH_R = {'arm_R': (88.0, 0.0, -10.0), 'fore_R': 4.0, 'hand_R': 'fist', 'torso': (12.0, 0.0, 22.0),
           'arm_L': (30.0, 8.0, -30.0), 'fore_L': 120.0}
WINDUP_R = {'arm_R': (-35.0, 25.0, 0.0), 'fore_R': 100.0, 'hand_R': 'fist', 'torso': (0.0, 0.0, -30.0),
            'arm_L': (50.0, 10.0, -30.0), 'fore_L': 90.0}
CROUCH = {'hips.loc': (0.0, 0.0, -0.22), 'leg_L': (62.0, 10.0, 6.0), 'leg_R': (62.0, 10.0, 6.0),
          'shin_L': 105.0, 'shin_R': 105.0, 'torso': (28.0, 0.0, 0.0)}
DUCK = dict(CROUCH, **{'hips.loc': (0.0, 0.0, -0.30), 'torso': (40.0, 0.0, 0.0), 'head': (20.0, 0.0, 0.0),
                       'arm_L': (60.0, 20.0, -60.0), 'fore_L': 120.0, 'arm_R': (60.0, 20.0, -60.0), 'fore_R': 120.0})
LUNGE = {'torso': (22.0, 0.0, 0.0), 'leg_L': (38.0, 4.0, 0.0), 'leg_R': (-28.0, 4.0, 0.0), 'shin_L': 30.0, 'shin_R': 10.0,
         'arm_L': (70.0, 10.0, 0.0), 'fore_L': 10.0, 'arm_R': (70.0, 10.0, 0.0), 'fore_R': 10.0,
         'hand_L': 'open', 'hand_R': 'open', 'hips.loc': (0.0, 0.0, -0.06)}
SLIP = {'torso': (-25.0, 0.0, 0.0), 'leg_L': (55.0, 10.0, 0.0), 'leg_R': (20.0, 10.0, 0.0), 'shin_L': 5.0, 'shin_R': 20.0,
        'arm_L': (20.0, 75.0, 0.0), 'fore_L': 30.0, 'arm_R': (20.0, 75.0, 0.0), 'fore_R': 30.0,
        'hand_L': 'open', 'hand_R': 'open'}
PROUD = {'torso': (-7.0, 0.0, 0.0), 'head': (-9.0, 0.0, 0.0), 'arm_L': (-8.0, 38.0, -55.0), 'fore_L': 105.0,
         'arm_R': (-8.0, 38.0, -55.0), 'fore_R': 105.0, 'hand_L': 'fist', 'hand_R': 'fist',
         'leg_L': (0.0, 6.0, 8.0), 'leg_R': (0.0, 6.0, 8.0)}
TOWEL_SWING_R = {'arm_R': (95.0, -15.0, 0.0), 'fore_R': 20.0, 'hand_R': 'fist', 'torso': (8.0, 0.0, 30.0)}
TOWEL_UP_R = {'arm_R': (150.0, 20.0, 0.0), 'fore_R': 40.0, 'hand_R': 'fist', 'torso': (-6.0, 0.0, -20.0)}
HOLD_MOUTH_R = {'arm_R': (55.0, -4.0, -55.0), 'fore_R': 130.0, 'hand_R': 'open', 'head': (14.0, 6.0, 0.0)}
DUST_HANDS = {'arm_L': (35.0, -2.0, -60.0), 'fore_L': 80.0, 'arm_R': (35.0, -2.0, -60.0), 'fore_R': 85.0,
              'hand_L': 'open', 'hand_R': 'open'}
LAUGH_BODY = {'torso': (-10.0, 0.0, 0.0), 'head': (-14.0, 0.0, 0.0), 'arm_L': (25.0, -5.0, -70.0), 'fore_L': 80.0,
              'arm_R': (25.0, -5.0, -70.0), 'fore_R': 80.0, 'hand_L': 'open', 'hand_R': 'open'}
CLIMB = {'hips.loc': (0.0, 0.0, -0.16), 'torso': (38.0, 0.0, 0.0), 'head': (-25.0, 0.0, 0.0),
         'leg_L': (70.0, 10.0, 0.0), 'shin_L': 90.0, 'leg_R': (30.0, 10.0, 0.0), 'shin_R': 60.0,
         'arm_L': (75.0, 18.0, 0.0), 'fore_L': 25.0, 'arm_R': (60.0, 18.0, 0.0), 'fore_R': 35.0,
         'hand_L': 'open', 'hand_R': 'open'}
LAND = {'hips.loc': (0.0, 0.0, -0.20), 'torso': (25.0, 0.0, 0.0), 'head': (-12.0, 0.0, 0.0),
        'leg_L': (55.0, 18.0, 6.0), 'shin_L': 95.0, 'leg_R': (50.0, 18.0, 6.0), 'shin_R': 90.0,
        'arm_L': (15.0, 45.0, 0.0), 'fore_L': 40.0, 'arm_R': (25.0, 10.0, 0.0), 'fore_R': 20.0,
        'hand_L': 'open', 'hand_R': 'open'}
STEP_BACK = {'torso': (-8.0, 0.0, 0.0), 'arm_L': (20.0, 10.0, 0.0), 'fore_L': 40.0, 'arm_R': (20.0, 10.0, 0.0),
             'fore_R': 40.0, 'hand_L': 'open', 'hand_R': 'open'}
HOOD_GRAB = {'arm_L': (150.0, 25.0, 0.0), 'fore_L': 60.0, 'arm_R': (150.0, 25.0, 0.0), 'fore_R': 60.0,
             'hand_L': 'fist', 'hand_R': 'fist'}

# Gesicht
F_CHILL = {'brow_L': (8.0, 0.0), 'brow_R': (8.0, 0.0), 'lid_L': 0.5, 'lid_R': 0.5, 'pupil': (0.0, -0.3),
           'pupil_s': 1.0, 'mouth': 'smirk'}
F_SLEEPY = {'brow_L': (14.0, -0.6), 'brow_R': (14.0, -0.6), 'lid_L': 0.66, 'lid_R': 0.66, 'pupil': (0.0, -0.8),
            'mouth': 'neutral'}
F_SUSPICIOUS = {'brow_L': (-10.0, -0.6), 'brow_R': (12.0, 0.6), 'lid_L': 0.62, 'lid_R': 0.45, 'mouth': 'frown'}
F_SURPRISE = {'brow_L': (-4.0, 1.6), 'brow_R': (-4.0, 1.6), 'lid_L': 0.12, 'lid_R': 0.12, 'pupil_s': 0.85, 'mouth': 'o'}
F_SHOCK = {'brow_L': (-6.0, 2.2), 'brow_R': (-6.0, 2.2), 'lid_L': 0.0, 'lid_R': 0.0, 'pupil_s': 0.72, 'mouth': 'o',
           'pupil': (0.0, 0.0)}
F_GRIN = {'brow_L': (-9.0, 0.0), 'brow_R': (-9.0, 0.0), 'lid_L': 0.42, 'lid_R': 0.42, 'mouth': 'smile'}
F_EVIL = {'brow_L': (-20.0, -0.8), 'brow_R': (-20.0, -0.8), 'lid_L': 0.38, 'lid_R': 0.38, 'mouth': 'creepy',
          'pupil': (0.0, 0.0)}
F_LAUGH = {'brow_L': (-2.0, 1.0), 'brow_R': (-2.0, 1.0), 'lid_L': 0.72, 'lid_R': 0.72, 'mouth': 'laugh'}
F_GRIMACE = {'brow_L': (-14.0, -0.6), 'brow_R': (-14.0, -0.6), 'lid_L': 0.55, 'lid_R': 0.55, 'mouth': 'grimace'}
F_ANGRY = {'brow_L': (-22.0, -1.0), 'brow_R': (-22.0, -1.0), 'lid_L': 0.35, 'lid_R': 0.35, 'mouth': 'grimace'}
F_SERIOUS = {'brow_L': (-16.0, -0.8), 'brow_R': (-16.0, -0.8), 'lid_L': 0.3, 'lid_R': 0.3, 'mouth': 'neutral',
             'pupil': (0.0, 0.0)}
F_SMUG = {'brow_L': (4.0, 0.4), 'brow_R': (10.0, -0.2), 'lid_L': 0.58, 'lid_R': 0.58, 'mouth': 'smile'}
F_PAIN = {'brow_L': (20.0, 0.8), 'brow_R': (20.0, 0.8), 'lid_L': 0.85, 'lid_R': 0.85, 'mouth': 'grimace'}
F_KO = {'brow_L': (18.0, 0.0), 'brow_R': (18.0, 0.0), 'lid_L': 1.0, 'lid_R': 1.0, 'mouth': 'o'}
F_WINK_L = {'lid_L': 1.0}
