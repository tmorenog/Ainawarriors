// Story chapters — 80 dramatic chapters loosely inspired by the
// Warriors books. The first seven are hand-scripted around the
// Tigerstar fight, Firestar's death, and the search for Graystripe.
// The rest auto-advance every few minutes of play so the campaign
// keeps moving as the player explores.

export interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  quest: string;
  // The store-level "trigger" key that completes this chapter. Game logic
  // calls __WOTC_TRIGGER__(key) when the right event fires.
  completeOn: string;
}

// Per-chapter subtitles + quests are deliberately punchy: each chapter
// is a banner moment.
function ch(num: number, title: string, subtitle: string, quest: string, completeOn: string = 'tick-3min'): Chapter {
  return { id: `ch-${num}`, title: `Chapter ${num} — ${title}`, subtitle, quest, completeOn };
}

export const CHAPTERS: Chapter[] = [
  // ---- Hand-scripted opening arc (~Tigerstar → Firestar → Graystripe) ----
  ch(1,  'Into the Wild',        'A young cat steps into the forest for the first time.',          'Explore your clan camp and meet your warriors.',                'visit-own-camp'),
  ch(2,  'Fire and Ice',         'The river runs cold. The clans test their borders.',             'Hunt three prey for the fresh-kill pile.',                       'hunt-three'),
  ch(3,  'Forest of Secrets',    'Tigerstar moves in the shadows. Whispers fill the trees.',       "Accept Firestar's mission and confront Tigerstar.",              'defeat-tigerstar'),
  ch(4,  'Rising Storm',         'Lightning over the lake. Greenleaf turns thunderous.',           'Survive a disaster — flood, fire, or twolegs.',                   'survive-disaster'),
  ch(5,  'A Dangerous Path',     'Firestar is gone. StarClan walk among the trees again.',         'Mourn Firestar at the Moonpool.',                                 'mourn-firestar'),
  ch(6,  'The Darkest Hour',     'Graystripe was taken by twolegs. Find him.',                     'Search for Graystripe across the territories.',                   'find-graystripe'),
  ch(7,  'Starlight',            'The clans heal. The stars are bright again.',                    'Return to your camp as the new Warriors.',                        'return-home'),
  // ---- Auto-advancing arc (~3 min apart, "The New Prophecy" through finale) ----
  ch(8,  'Midnight',             'A badger speaks an omen at the dark of the moon.',               'Walk the moonlit forest with your patrol.'),
  ch(9,  'Moonrise',             'Three cats leave to find sun-drown-place.',                      'Travel beyond your clan border.'),
  ch(10, 'Dawn',                 'A long journey home. Snow on the broken bridge.',                'Return to the lake by morning.'),
  ch(11, 'Twilight',             'Strange shadows under the Great Oak.',                            'Stand beneath the Great Oak on the Gathering island.'),
  ch(12, 'Sunset',               'A leader\'s last sunset.',                                       'Climb your clan\'s High Rock.'),
  ch(13, 'The Sight',            'A young apprentice sees what others can\'t.',                    'Sleep in the medicine den.'),
  ch(14, 'Dark River',           'Tunnels under the moor. Voices in the dark.',                    'Cross every stream in the territory.'),
  ch(15, 'Outcast',              'A cat from the gorge brings hard news.',                          'Find the SkyClan camp.'),
  ch(16, 'Eclipse',              'The sun turns black above WindClan.',                            'Stand on the moor under a noon sky.'),
  ch(17, 'Long Shadows',         'Sickness in the leaf-bare camps.',                                'Gather three herbs for the medicine den.'),
  ch(18, 'Sunrise',              'The truth at last, in the first morning light.',                  'Reach the lake at sunrise.'),
  ch(19, 'The Fourth Apprentice','A drought, a journey, a prophecy of four.',                       'Catch a fish from the river.'),
  ch(20, 'Fading Echoes',        'Old training grounds. Old enemies.',                              'Visit Snakerocks.'),
  ch(21, 'Night Whispers',       'A spy in the warriors\' den.',                                    'Sit in the warriors\' den after dusk.'),
  ch(22, 'Sign of the Moon',     'A she-cat lights the path to the mountains.',                    'Climb to a high vantage and look out.'),
  ch(23, 'The Forgotten Warrior','A long-lost warrior returns from far away.',                      'Greet every clan leader at the Gathering.'),
  ch(24, 'The Last Hope',        'A great battle is coming. The clans must stand together.',       'Survive a raid on your camp.'),
  ch(25, 'The Sun Trail',        'The earliest cats first cross the high stones.',                  'Walk the Highstones path.'),
  ch(26, 'Thunder Rising',       'A young tom finds his name in a flash of fire.',                  'Sprint across the moor at sunhigh.'),
  ch(27, 'The First Battle',     'Border lines drawn in blood.',                                    'Win a fight with a rival warrior.'),
  ch(28, 'The Blazing Star',     'A burning sign over the camp.',                                    'See a shooting star while awake.'),
  ch(29, 'A Forest Divided',     'Friends become strangers across the new borders.',                'Patrol the entire clan border.'),
  ch(30, 'Path of Stars',        'The first leaders climb to receive their nine lives.',            'Spend a full night near the Moonpool.'),
  ch(31, "The Apprentice's Quest",'Old prophecies stir under a new generation.',                    'Mentor an apprentice (talk to one in camp).'),
  ch(32, 'Thunder and Shadow',   'Two clans share a camp — uneasy peace.',                          'Walk through ShadowClan territory.'),
  ch(33, 'Shattered Sky',        'The sky cracks open. SkyClan\'s return.',                         'Stand at the SkyClan gathering rock.'),
  ch(34, 'Darkest Night',        'Black sky, no moon. The dark forest stirs.',                      'Survive the night in unfamiliar territory.'),
  ch(35, 'River of Fire',        'The Thunderpath burns. Twoleg fires spread.',                     'Cross the Thunderpath safely.'),
  ch(36, 'The Raging Storm',     'A flood that does not stop.',                                     'Reach high ground during a flood disaster.'),
  ch(37, 'Lost Stars',           'StarClan goes silent. The medicine cats dream nothing.',          'Sleep three nights in a row.'),
  ch(38, 'The Silent Thaw',      'No songbirds. No prey. A heavy hush.',                            'Hunt successfully during leaf-bare.'),
  ch(39, 'Veil of Shadows',      'A new leader covers something with lies.',                        'Confront an impostor.'),
  ch(40, 'Darkness Within',      'The Dark Forest claws its way back into dreams.',                 'Win a battle against the odds.'),
  ch(41, 'The Place of No Stars','An old battleground awakens.',                                    'Sit through a starless night.'),
  ch(42, 'A Light in the Mist',  'A glimmer of hope across the lake.',                              'Cross the halfbridge.'),
  ch(43, 'River',                'RiverClan stories told around fish bones.',                       'Visit RiverClan camp.'),
  ch(44, 'Sky',                  'SkyClan\'s gorge song echoes through the lake territories.',     'Visit SkyClan camp.'),
  ch(45, 'Shadow',               'ShadowClan whispers in pine shadow.',                             'Visit ShadowClan camp.'),
  ch(46, 'Thunder',              'A roaring storm over ThunderClan.',                               'Visit ThunderClan camp.'),
  ch(47, 'Wind',                 'WindClan run beneath a sky of grass.',                            'Visit WindClan camp.'),
  ch(48, 'Star',                 'The five clans look up together.',                                'Stand beside cats of every clan at a Gathering.'),
  ch(49, "Firestar's Echo",      'A flame that never quite goes out.',                              'Honor Firestar at the High Rock.'),
  ch(50, "Bluestar's Memory",    'An old leader\'s nine lives still ripple in the forest.',         'Tell a kit a story from the warriors\' den.'),
  ch(51, "Crookedstar's Promise",'A jagged-jaw tom keeps a promise to the river.',                  'Stand at the river bank in moonlight.'),
  ch(52, "Yellowfang's Secret",  'A medicine cat carries a heavy past.',                            'Heal a wounded clanmate — open the Herbs panel and use a herb.', 'heal-warrior'),
  ch(53, "Tallstar's Revenge",   'WindClan\'s last good hunt in the old territory.',                'Chase a rabbit across the moor.'),
  ch(54, "Bramblestar's Storm",  'A flood reshapes the lake.',                                      'Help rebuild a camp after a flood.'),
  ch(55, "Moth Flight's Vision", 'The first medicine cat sees StarClan.',                           'Reach the Moonstone cave.'),
  ch(56, "Hawkwing's Journey",   'A cat finds a clan he never knew he had.',                        'Walk every territory in one day.'),
  ch(57, "Tigerheart's Shadow",  'A young leader walks Twolegplace before the gorge.',              'Visit the Twolegplace and return safely.'),
  ch(58, "Crowfeather's Trial",  'A father, a son, a hard road home.',                              'Reconcile with a clanmate.'),
  ch(59, "Squirrelflight's Hope",'A deputy fights for her family.',                                 'Defend the nursery during a raid.'),
  ch(60, "Graystripe's Vow",     'A long road back to ThunderClan.',                                'Walk the path from the Twolegplace to camp.'),
  ch(61, "Leopardstar's Honor",  'A spotted leader\'s last fight.',                                 'Honor a fallen warrior.'),
  ch(62, "Onestar's Confession", 'A leader admits one final truth.',                                'Speak the truth in front of every clan leader.'),
  ch(63, "Spotfur's Rebellion",  'Young warriors rise against a tyrant.',                           'Lead an apprentice on patrol.'),
  ch(64, "Riverstar's Home",     'The first RiverClan finds the river.',                            'Fish three times in the stream.'),
  ch(65, "Thunderstar's Echo",   'A wide-pawed founder rises in the east.',                         'Be the first to scent a patrol crossing the border.'),
  ch(66, "Shadowstar's Life",    'A pine-quiet cat names her clan.',                                'Spend a night in ShadowClan territory.'),
  ch(67, "Windstar's Path",      'A long runner founds the moor.',                                  'Sprint a full circuit of the territory.'),
  ch(68, "Skystar's Legacy",     'A leaping cat founds a fifth clan.',                              'Climb to the highest point of the world.'),
  ch(69, "Tigerstar's Fury",     'A storm with teeth returns from the dark.',                       'Confront a dark warrior in your dreams.'),
  ch(70, "Bramblestar's Tale",   'A leader chosen by storm and starlight.',                         'Receive a ninth life from a dream of a leader.'),
  ch(71, "Ravenpaw's Path",      'A quiet cat finds his place at the barn.',                        'Visit Horseplace.'),
  ch(72, "Mistystar's Tale",     'Soft mist over the river.',                                       'Walk the river bank at dawn.'),
  ch(73, "Cloudstar's Journey",  'A clan in the gorge.',                                            'Reach the abandoned SkyClan territory.'),
  ch(74, 'The Dark Forest War',  'Every clan stands. Every dark cat falls.',                        'Win a battle alongside three clanmates.'),
  ch(75, 'After the Battle',     'A long quiet, then a long healing.',                              'Eat from the fresh-kill pile after a victory.'),
  ch(76, 'New Leaves',           'Newleaf at last. Kits everywhere.',                               'Visit the nursery.'),
  ch(77, 'A Leader\'s Lives',    'Nine lives whispered under the stars.',                           'Receive a vision from StarClan.'),
  ch(78, 'The Stars Look Down',  'A peaceful moment under a starlit sky.',                          'Stand at the Moonpool at midnight.'),
  ch(79, 'The Last Gathering',   'All five clans at peace.',                                        'Attend a Gathering with no fighting.'),
  ch(80, 'A New Dawn',           'The clans live on. The forest watches.',                          'Lead your clan into a new dawn.'),
];

export function chapterAt(index: number): Chapter {
  return CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, index))];
}
