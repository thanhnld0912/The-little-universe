-- 003_seed_tarot.sql
-- The 78-card deck: 22 Major Arcana + 56 Minor Arcana (14 x 4 suits).
--
-- CONTENT PROVENANCE
--
-- Every line of copy below was written for The Little Universe. Nothing is
-- copied from handebudak/tarott (proprietary, all rights reserved), from
-- krates98/tarotcardapi (no licence at all), from mixvlad/TarotCards
-- (NOASSERTION), or from any other dataset. See THIRD_PARTY_NOTICES.md.
--
-- Card names, numbering, suits, ranks and elemental attributions are
-- long-established public-domain tarot tradition, as are the broad themes each
-- card carries. A. E. Waite's Pictorial Key to the Tarot (1911) is itself in
-- the public domain and informed the traditional associations; no passage from
-- it is reproduced here.
--
-- VOICE
--
-- Readings suggest, they never predict. Every meaning is phrased as an
-- invitation ("may", "might", "one possible reading is", "this card invites
-- you to") because this is reflective entertainment, not a forecast. No card
-- carries a fear-based reading, and none touches medical, financial or legal
-- territory. The traditionally difficult cards - Death, The Tower, the Nines
-- and Tens of Swords - are written toward what becomes possible afterwards.
--
-- image_url is NULL for every card: the frontend draws its own SVG artwork and
-- loads no images. No external image dependency is introduced.

INSERT INTO tarot_cards
  (slug, name, arcana, suit, number, numeral, archetype, keywords, element,
   upright_meaning, reversed_meaning, image_url)
VALUES

-- ===========================================================================
-- MAJOR ARCANA (22)
-- ===========================================================================
('the-fool', 'The Fool', 'major', NULL, 0, '0',
 'Beginnings, Innocence & the Open Road',
 ARRAY['Beginning', 'Trust', 'Freedom', 'Possibility'], 'Air',
 'Something in you may be ready to begin before you feel ready. The Fool suggests a step taken in good faith, with more curiosity than certainty.',
 'One possible reading is that caution has quietly become a habit rather than a choice. This card may invite you to notice what you are calling recklessness that is really just change.',
 NULL),

('the-magician', 'The Magician', 'major', NULL, 1, 'I',
 'Focus, Will & Making Things Real',
 ARRAY['Focus', 'Skill', 'Intention', 'Resourcefulness'], 'Mercury',
 'You may already hold more of what you need than you have counted. The Magician points to the moment where scattered ability becomes a single clear intention.',
 'Energy may be moving in several directions at once. This card invites you to ask which of your efforts are truly yours, and which you took on to be seen.',
 NULL),

('the-high-priestess', 'The High Priestess', 'major', NULL, 2, 'II',
 'Intuition, Stillness & Inner Knowing',
 ARRAY['Intuition', 'Patience', 'Mystery', 'Inner Voice'], 'Moon',
 'Some answers arrive only in quiet. The High Priestess suggests that waiting is not passivity here, and that you may already know more than you can explain.',
 'The signal may be hard to hear over other voices. One possible interpretation is that a quiet certainty has been talked out of you.',
 NULL),

('the-empress', 'The Empress', 'major', NULL, 3, 'III',
 'Abundance, Care & Creative Growth',
 ARRAY['Nurture', 'Creativity', 'Warmth', 'Growth'], 'Venus',
 'Something you have tended may be beginning to flourish. The Empress invites you to receive care as easily as you give it.',
 'You may be pouring warmth outward faster than it returns. This card asks gently whether your own garden has been left unwatered.',
 NULL),

('the-emperor', 'The Emperor', 'major', NULL, 4, 'IV',
 'Structure, Boundaries & Steady Ground',
 ARRAY['Structure', 'Boundaries', 'Stability', 'Order'], 'Aries',
 'A firm shape may be what your freedom needs. The Emperor suggests that a boundary drawn kindly can hold more than an open door.',
 'Control may be standing in for safety. One possible reading is that a structure built to protect you has begun to confine you instead.',
 NULL),

('the-hierophant', 'The Hierophant', 'major', NULL, 5, 'V',
 'Tradition, Guidance & Shared Meaning',
 ARRAY['Tradition', 'Guidance', 'Belonging', 'Learning'], 'Taurus',
 'There may be wisdom already worn smooth by others who came before. The Hierophant invites you to accept help without feeling diminished by it.',
 'An inherited rule may no longer fit the person you have become. This card suggests it is possible to keep the meaning and release the form.',
 NULL),

('the-lovers', 'The Lovers', 'major', NULL, 6, 'VI',
 'Choice, Union & Honest Alignment',
 ARRAY['Choice', 'Connection', 'Values', 'Honesty'], 'Gemini',
 'This may be less about romance than about alignment. The Lovers points to a choice where the honest answer and the easy answer are not the same.',
 'Something may be out of tune between what you want and what you have agreed to. One possible interpretation is that a decision is still waiting to be made.',
 NULL),

('the-chariot', 'The Chariot', 'major', NULL, 7, 'VII',
 'Momentum, Will & Directed Motion',
 ARRAY['Momentum', 'Determination', 'Direction', 'Resolve'], 'Cancer',
 'Opposing pulls can move together once you decide where you are going. The Chariot suggests forward motion earned rather than granted.',
 'Effort may be high and direction unclear. This card invites you to slow enough to check the road before pressing harder on it.',
 NULL),

('strength', 'Strength', 'major', NULL, 8, 'VIII',
 'Gentle Courage & Quiet Power',
 ARRAY['Courage', 'Patience', 'Compassion', 'Resilience'], 'Leo',
 'The strongest response here may be the softest one. Strength suggests power that does not need to raise its voice.',
 'You may be treating your own tenderness as a fault. One possible reading is that self-forgiveness is the harder and more useful courage today.',
 NULL),

('the-hermit', 'The Hermit', 'major', NULL, 9, 'IX',
 'Solitude, Reflection & Inner Light',
 ARRAY['Solitude', 'Reflection', 'Wisdom', 'Search'], 'Virgo',
 'Stepping back may not be retreat. The Hermit suggests that a little distance can return your own thinking to you.',
 'Solitude may have quietly become isolation. This card invites you to notice whether the door you closed for peace is still meant to be closed.',
 NULL),

('wheel-of-fortune', 'The Wheel of Fortune', 'major', NULL, 10, 'X',
 'Cycles, Timing & Turning Points',
 ARRAY['Cycles', 'Change', 'Timing', 'Fortune'], 'Jupiter',
 'Circumstances may be moving whether or not you push them. The Wheel suggests a turn in the pattern, and an invitation to meet it rather than brace against it.',
 'The same shape may seem to keep returning. One possible interpretation is that the cycle is not repeating but spiralling, a little further along each time.',
 NULL),

('justice', 'Justice', 'major', NULL, 11, 'XI',
 'Balance, Truth & Fair Measure',
 ARRAY['Balance', 'Truth', 'Fairness', 'Accountability'], 'Libra',
 'Something may be asking to be weighed honestly. Justice suggests clarity gained by looking directly rather than kindly away.',
 'A scale may be tilted by an old story rather than present facts. This card invites you to separate what happened from what you concluded.',
 NULL),

('the-hanged-man', 'The Hanged Man', 'major', NULL, 12, 'XII',
 'Pause, Perspective & Willing Surrender',
 ARRAY['Pause', 'Perspective', 'Release', 'Waiting'], 'Water',
 'A pause here may be doing more work than motion would. The Hanged Man suggests seeing the same situation from an unfamiliar angle.',
 'Waiting may have outlasted its usefulness. One possible reading is that what began as patience has settled into avoidance.',
 NULL),

('death', 'Death', 'major', NULL, 13, 'XIII',
 'Endings, Release & Necessary Change',
 ARRAY['Endings', 'Transformation', 'Release', 'Renewal'], 'Scorpio',
 'Something may be completing so that something else can begin. This card is rarely about loss alone, and more often about what becomes possible once the ending is allowed.',
 'You may be holding the shape of something that has already ended. This card invites you to let the ending finish, so that the next thing has room to arrive.',
 NULL),

('temperance', 'Temperance', 'major', NULL, 14, 'XIV',
 'Balance, Blending & Patient Measure',
 ARRAY['Balance', 'Patience', 'Moderation', 'Harmony'], 'Sagittarius',
 'The right proportion may matter more than the right ingredient. Temperance suggests small adjustments rather than dramatic correction.',
 'Something may be running to an extreme. One possible interpretation is that the middle path feels dull only because it is unfamiliar.',
 NULL),

('the-devil', 'The Devil', 'major', NULL, 15, 'XV',
 'Attachment, Habit & What Binds',
 ARRAY['Attachment', 'Habit', 'Shadow', 'Freedom'], 'Capricorn',
 'This card points to something that holds you more tightly than you would choose. It may be a habit, a story, or a comfort that quietly costs more than it gives.',
 'A chain may be looser than it looks. One possible reading is that you have already begun to leave, and simply have not said so yet.',
 NULL),

('the-tower', 'The Tower', 'major', NULL, 16, 'XVI',
 'Sudden Change & Honest Ground',
 ARRAY['Upheaval', 'Revelation', 'Clearing', 'Truth'], 'Mars',
 'Something built on an unsteady base may be shifting. This card suggests that what falls here was rarely what you actually needed.',
 'A change may be arriving slowly rather than suddenly. This card invites you to look at what you have been shoring up rather than rebuilding.',
 NULL),

('the-star', 'The Star', 'major', NULL, 17, 'XVII',
 'Hope, Renewal & Gentle Light',
 ARRAY['Hope', 'Healing', 'Renewal', 'Faith'], 'Aquarius',
 'After a difficult stretch, something quiet may be restoring itself. The Star suggests hope that does not need proof in order to be real.',
 'Hope may feel like a risk right now. One possible interpretation is that you are guarding against disappointment more carefully than you need to.',
 NULL),

('the-moon', 'The Moon', 'major', NULL, 18, 'XVIII',
 'Uncertainty, Dreams & the Half-Lit Path',
 ARRAY['Intuition', 'Uncertainty', 'Dreams', 'Imagination'], 'Pisces',
 'Not everything is visible yet, and that may be all right. The Moon suggests moving gently through what you cannot fully see.',
 'Something may be coming clear that was confusing before. This card invites you to trust the shape emerging out of the fog.',
 NULL),

('the-sun', 'The Sun', 'major', NULL, 19, 'XIX',
 'Clarity, Warmth & Simple Joy',
 ARRAY['Joy', 'Clarity', 'Warmth', 'Vitality'], 'Sun',
 'Something uncomplicated may be waiting to be enjoyed. The Sun suggests warmth that asks nothing of you but your attention.',
 'Brightness may be there and hard to feel. One possible reading is that joy is present but has not yet been let in.',
 NULL),

('judgement', 'Judgement', 'major', NULL, 20, 'XX',
 'Reckoning, Awakening & Clear Sight',
 ARRAY['Awakening', 'Reflection', 'Renewal', 'Calling'], 'Fire',
 'Something may be asking to be looked at honestly and then released. Judgement suggests a clear-eyed reckoning that ends in relief rather than blame.',
 'You may be holding yourself to a verdict long since served. This card invites a gentler standard than the one you have been using.',
 NULL),

('the-world', 'The World', 'major', NULL, 21, 'XXI',
 'Completion, Wholeness & Arrival',
 ARRAY['Completion', 'Wholeness', 'Arrival', 'Integration'], 'Saturn',
 'A cycle may be closing well. The World suggests an arrival worth pausing inside before the next thing begins.',
 'Something may be nearly finished and not quite released. One possible interpretation is that the last small step is the one being avoided.',
 NULL),

-- ===========================================================================
-- WANDS (14) - fire, drive, creativity, will
-- ===========================================================================
('ace-of-wands', 'Ace of Wands', 'minor', 'wands', 1, 'I',
 'Spark, Beginning & Creative Fire',
 ARRAY['Spark', 'Inspiration', 'Beginning', 'Energy'], 'Fire',
 'An idea may be arriving with more heat than form. The Ace of Wands suggests beginning before the plan is finished.',
 'A spark may simply be waiting for air. One possible reading is that an idea has been kept private long enough.',
 NULL),

('two-of-wands', 'Two of Wands', 'minor', 'wands', 2, 'II',
 'Planning, Horizon & the First Choice',
 ARRAY['Planning', 'Vision', 'Choice', 'Horizon'], 'Fire',
 'You may be standing between a place that is safe and a place that is interesting. This card invites you to look further out than usual.',
 'Plans may be circling without landing. This card suggests that one small commitment would clarify more than further deliberation.',
 NULL),

('three-of-wands', 'Three of Wands', 'minor', 'wands', 3, 'III',
 'Expansion, Foresight & Ships on the Water',
 ARRAY['Expansion', 'Foresight', 'Patience', 'Progress'], 'Fire',
 'Something already set in motion may be on its way back to you. The Three of Wands suggests waiting well rather than waiting anxiously.',
 'Returns may be slower than hoped. One possible interpretation is that the timeline was optimistic, not that the effort was wrong.',
 NULL),

('four-of-wands', 'Four of Wands', 'minor', 'wands', 4, 'IV',
 'Celebration, Home & Earned Rest',
 ARRAY['Celebration', 'Home', 'Belonging', 'Rest'], 'Fire',
 'A milestone may deserve more acknowledgement than you have given it. This card invites you to stop and mark the moment.',
 'Celebration may feel out of reach or slightly hollow. This card suggests looking at who you would want beside you rather than at what is missing.',
 NULL),

('five-of-wands', 'Five of Wands', 'minor', 'wands', 5, 'V',
 'Friction, Competition & Useful Conflict',
 ARRAY['Friction', 'Competition', 'Challenge', 'Practice'], 'Fire',
 'Disagreement here may be more productive than harmful. The Five of Wands suggests that friction is sometimes how a thing gets sharpened.',
 'Conflict may have grown tiring rather than useful. One possible reading is that stepping out of the contest costs less than winning it.',
 NULL),

('six-of-wands', 'Six of Wands', 'minor', 'wands', 6, 'VI',
 'Recognition, Confidence & Return',
 ARRAY['Recognition', 'Confidence', 'Achievement', 'Pride'], 'Fire',
 'Something you worked at may be seen. The Six of Wands suggests receiving recognition without immediately deflecting it.',
 'Recognition may be absent or uncomfortable. This card invites you to name your own progress even if no one else has.',
 NULL),

('seven-of-wands', 'Seven of Wands', 'minor', 'wands', 7, 'VII',
 'Standing Ground & Defending What Matters',
 ARRAY['Courage', 'Conviction', 'Defence', 'Persistence'], 'Fire',
 'You may be holding a position that is worth holding. The Seven of Wands suggests that steadiness matters more than volume here.',
 'Defending may have become exhausting. One possible interpretation is that not every challenge requires your answer.',
 NULL),

('eight-of-wands', 'Eight of Wands', 'minor', 'wands', 8, 'VIII',
 'Speed, Movement & Messages',
 ARRAY['Speed', 'Movement', 'News', 'Momentum'], 'Fire',
 'Things may move faster than they have in a while. This card suggests readiness rather than resistance.',
 'Momentum may be stalling or scattered. This card invites you to let a delay be a delay rather than a verdict.',
 NULL),

('nine-of-wands', 'Nine of Wands', 'minor', 'wands', 9, 'IX',
 'Resilience, Weariness & the Last Stretch',
 ARRAY['Resilience', 'Endurance', 'Vigilance', 'Persistence'], 'Fire',
 'You may be more tired than you have admitted and still standing. The Nine of Wands suggests that being weary is not the same as being finished.',
 'Guardedness may be costing more than it protects. One possible reading is that it is safe to lower your shoulders a little.',
 NULL),

('ten-of-wands', 'Ten of Wands', 'minor', 'wands', 10, 'X',
 'Burden, Load & What Can Be Set Down',
 ARRAY['Burden', 'Responsibility', 'Effort', 'Release'], 'Fire',
 'You may be carrying something that was never meant to be carried alone. This card invites you to notice what could be shared or set down.',
 'A load may be ready to release. This card suggests that letting go of one thing may restore your capacity for the rest.',
 NULL),

('page-of-wands', 'Page of Wands', 'minor', 'wands', 11, 'XI',
 'Curiosity, News & Beginning to Learn',
 ARRAY['Curiosity', 'Enthusiasm', 'Discovery', 'Beginning'], 'Fire',
 'A new interest may be worth following without needing it to become serious. The Page of Wands suggests learning for its own sake.',
 'Enthusiasm may be fading quickly. One possible interpretation is that the idea was borrowed rather than truly yours.',
 NULL),

('knight-of-wands', 'Knight of Wands', 'minor', 'wands', 12, 'XII',
 'Drive, Adventure & Forward Motion',
 ARRAY['Drive', 'Adventure', 'Boldness', 'Impulse'], 'Fire',
 'Energy may be high and pointed outward. This card suggests action taken with courage, and a gentle reminder to look before leaping.',
 'Movement may be restless rather than directed. This card invites you to choose one road rather than starting three.',
 NULL),

('queen-of-wands', 'Queen of Wands', 'minor', 'wands', 13, 'XIII',
 'Warmth, Confidence & Magnetic Presence',
 ARRAY['Warmth', 'Confidence', 'Creativity', 'Presence'], 'Fire',
 'You may be more capable of drawing people in than you realise. The Queen of Wands suggests warmth used deliberately.',
 'Confidence may feel performed rather than felt. One possible reading is that rest would restore more than effort would.',
 NULL),

('king-of-wands', 'King of Wands', 'minor', 'wands', 14, 'XIV',
 'Vision, Leadership & Steady Fire',
 ARRAY['Vision', 'Leadership', 'Mastery', 'Conviction'], 'Fire',
 'You may be ready to lead something rather than simply take part in it. This card suggests fire that has learned patience.',
 'Authority may be tipping toward inflexibility. This card invites you to make room for a voice other than your own.',
 NULL),

-- ===========================================================================
-- CUPS (14) - water, feeling, connection, intuition
-- ===========================================================================
('ace-of-cups', 'Ace of Cups', 'minor', 'cups', 1, 'I',
 'Opening, Feeling & New Warmth',
 ARRAY['Openness', 'Feeling', 'Beginning', 'Tenderness'], 'Water',
 'Something may be opening in you emotionally. The Ace of Cups suggests receiving before analysing.',
 'Feeling may be present and unexpressed. One possible interpretation is that the cup is full and simply has not been offered.',
 NULL),

('two-of-cups', 'Two of Cups', 'minor', 'cups', 2, 'II',
 'Connection, Mutuality & Meeting',
 ARRAY['Connection', 'Partnership', 'Mutuality', 'Attraction'], 'Water',
 'Something may be forming between you and another. This card suggests connection built on equal footing.',
 'Balance in a connection may need attention. This card invites you to notice who has been giving more.',
 NULL),

('three-of-cups', 'Three of Cups', 'minor', 'cups', 3, 'III',
 'Friendship, Gathering & Shared Joy',
 ARRAY['Friendship', 'Community', 'Celebration', 'Belonging'], 'Water',
 'Company may be exactly what is needed. The Three of Cups suggests joy that grows by being shared.',
 'You may feel slightly outside the circle. One possible reading is that reaching out costs less than you expect.',
 NULL),

('four-of-cups', 'Four of Cups', 'minor', 'cups', 4, 'IV',
 'Restlessness, Enough & the Offered Cup',
 ARRAY['Contemplation', 'Restlessness', 'Reflection', 'Attention'], 'Water',
 'Something good may be offered while your attention is elsewhere. This card invites you to look up.',
 'Interest may be returning after a flat stretch. This card suggests curiosity quietly finding its way back.',
 NULL),

('five-of-cups', 'Five of Cups', 'minor', 'cups', 5, 'V',
 'Grief, Loss & What Remains',
 ARRAY['Grief', 'Loss', 'Regret', 'Perspective'], 'Water',
 'Something may be genuinely worth grieving. The Five of Cups suggests feeling it fully, and noticing in time that not everything was spilled.',
 'You may be beginning to turn around. One possible interpretation is that acceptance is arriving quietly.',
 NULL),

('six-of-cups', 'Six of Cups', 'minor', 'cups', 6, 'VI',
 'Memory, Nostalgia & Old Kindness',
 ARRAY['Memory', 'Nostalgia', 'Innocence', 'Kindness'], 'Water',
 'The past may be offering something gentle. This card suggests remembering warmly without needing to return.',
 'Nostalgia may be holding more of your attention than the present. This card invites you back to what is here.',
 NULL),

('seven-of-cups', 'Seven of Cups', 'minor', 'cups', 7, 'VII',
 'Choices, Imagination & Many Cups',
 ARRAY['Choices', 'Imagination', 'Possibility', 'Discernment'], 'Water',
 'Many options may look equally bright. The Seven of Cups suggests testing which of them are real.',
 'Clarity may be arriving. One possible reading is that one option has quietly become obvious.',
 NULL),

('eight-of-cups', 'Eight of Cups', 'minor', 'cups', 8, 'VIII',
 'Leaving, Search & Walking On',
 ARRAY['Departure', 'Search', 'Letting Go', 'Change'], 'Water',
 'Something may have given what it had to give. This card suggests leaving without needing it to have been a mistake.',
 'You may be deciding whether to stay. This card invites honesty about what would need to change.',
 NULL),

('nine-of-cups', 'Nine of Cups', 'minor', 'cups', 9, 'IX',
 'Contentment, Wish & Quiet Satisfaction',
 ARRAY['Contentment', 'Gratitude', 'Satisfaction', 'Wish'], 'Water',
 'Something you wanted may be here. The Nine of Cups suggests letting yourself enjoy it before looking for the next thing.',
 'Satisfaction may feel just out of reach. One possible interpretation is that the wish has changed and has not been updated.',
 NULL),

('ten-of-cups', 'Ten of Cups', 'minor', 'cups', 10, 'X',
 'Belonging, Harmony & Shared Home',
 ARRAY['Harmony', 'Family', 'Belonging', 'Peace'], 'Water',
 'Something may be settling into warmth. This card suggests connection that feels like ground rather than effort.',
 'A gap may exist between the picture and the feeling. This card invites you to tend the real thing rather than the image of it.',
 NULL),

('page-of-cups', 'Page of Cups', 'minor', 'cups', 11, 'XI',
 'Wonder, Feeling & Gentle Beginnings',
 ARRAY['Wonder', 'Sensitivity', 'Openness', 'Message'], 'Water',
 'A tender feeling or small message may be arriving. The Page of Cups suggests meeting it without armour.',
 'Sensitivity may feel like too much right now. This card invites you to treat your own softness kindly.',
 NULL),

('knight-of-cups', 'Knight of Cups', 'minor', 'cups', 12, 'XII',
 'Romance, Offering & Following the Heart',
 ARRAY['Romance', 'Idealism', 'Offering', 'Devotion'], 'Water',
 'You may be moved to offer something sincerely. This card suggests following feeling with care rather than caution.',
 'Idealism may be running ahead of reality. One possible reading is that the feeling is real while the story around it is not yet.',
 NULL),

('queen-of-cups', 'Queen of Cups', 'minor', 'cups', 13, 'XIII',
 'Empathy, Depth & Emotional Wisdom',
 ARRAY['Empathy', 'Intuition', 'Compassion', 'Depth'], 'Water',
 'You may be holding a great deal for other people. The Queen of Cups suggests that the same compassion belongs to you.',
 'Boundaries may have blurred. This card invites you to notice where your feelings end and someone else''s begin.',
 NULL),

('king-of-cups', 'King of Cups', 'minor', 'cups', 14, 'XIV',
 'Steadiness, Warmth & Feeling Held Well',
 ARRAY['Composure', 'Warmth', 'Maturity', 'Balance'], 'Water',
 'Feeling and steadiness may be working together. This card suggests emotional calm that comes from practice rather than from distance.',
 'Calm may be closer to suppression. One possible interpretation is that something unspoken is asking for air.',
 NULL),

-- ===========================================================================
-- SWORDS (14) - air, thought, truth, clarity
-- ===========================================================================
('ace-of-swords', 'Ace of Swords', 'minor', 'swords', 1, 'I',
 'Clarity, Truth & the First Clear Thought',
 ARRAY['Clarity', 'Truth', 'Insight', 'Breakthrough'], 'Air',
 'Something may become suddenly clear. The Ace of Swords suggests a truth that is simpler than the confusion around it.',
 'Clarity may be near and not yet formed. This card invites you to wait a little before deciding.',
 NULL),

('two-of-swords', 'Two of Swords', 'minor', 'swords', 2, 'II',
 'Stalemate, Avoidance & the Unmade Choice',
 ARRAY['Indecision', 'Stalemate', 'Avoidance', 'Balance'], 'Air',
 'A decision may be held carefully in place. This card suggests that not choosing is itself a choice.',
 'Something may be shifting toward a decision. One possible reading is that you already know, and are gathering courage.',
 NULL),

('three-of-swords', 'Three of Swords', 'minor', 'swords', 3, 'III',
 'Heartache, Honesty & Clean Pain',
 ARRAY['Heartache', 'Honesty', 'Sorrow', 'Healing'], 'Air',
 'Something may hurt precisely because it was true. The Three of Swords suggests pain that clarifies rather than destroys.',
 'Healing may already be underway. This card invites you to let the ache be smaller than it was.',
 NULL),

('four-of-swords', 'Four of Swords', 'minor', 'swords', 4, 'IV',
 'Rest, Recovery & Deliberate Stillness',
 ARRAY['Rest', 'Recovery', 'Stillness', 'Retreat'], 'Air',
 'Rest may not be optional here. The Four of Swords suggests stopping before you are made to stop.',
 'You may be ready to return. This card suggests re-entering slowly rather than all at once.',
 NULL),

('five-of-swords', 'Five of Swords', 'minor', 'swords', 5, 'V',
 'Conflict, Cost & Hollow Winning',
 ARRAY['Conflict', 'Tension', 'Cost', 'Pride'], 'Air',
 'A disagreement may be winnable and not worth winning. This card invites you to count the cost before pressing further.',
 'Repair may be possible. One possible interpretation is that someone is waiting for the first gentle word.',
 NULL),

('six-of-swords', 'Six of Swords', 'minor', 'swords', 6, 'VI',
 'Transition, Passage & Moving On',
 ARRAY['Transition', 'Passage', 'Recovery', 'Movement'], 'Air',
 'You may be moving toward calmer water. The Six of Swords suggests leaving quietly rather than dramatically.',
 'Something may be keeping you in place. This card invites you to name what you are still carrying.',
 NULL),

('seven-of-swords', 'Seven of Swords', 'minor', 'swords', 7, 'VII',
 'Strategy, Discretion & What Is Unsaid',
 ARRAY['Strategy', 'Discretion', 'Independence', 'Caution'], 'Air',
 'A quieter approach may serve better than a direct one. This card suggests discretion, and honesty with yourself about why.',
 'Something concealed may be ready to be said. One possible reading is that the secret has become heavier than the truth.',
 NULL),

('eight-of-swords', 'Eight of Swords', 'minor', 'swords', 8, 'VIII',
 'Restriction, Belief & the Loosened Rope',
 ARRAY['Restriction', 'Belief', 'Perspective', 'Doubt'], 'Air',
 'Limits may feel absolute and be partly self-made. This card invites you to test which walls are actually walls.',
 'Something may be loosening. This card suggests that the first small movement is the difficult one.',
 NULL),

('nine-of-swords', 'Nine of Swords', 'minor', 'swords', 9, 'IX',
 'Night Thoughts & the Long Hours',
 ARRAY['Worry', 'Overthinking', 'Restlessness', 'Relief'], 'Air',
 'Worry may be larger at night than it is by daylight. The Nine of Swords suggests treating your thoughts as weather rather than as verdict.',
 'The worst of it may be passing. This card invites you to say the fear aloud and watch it become smaller.',
 NULL),

('ten-of-swords', 'Ten of Swords', 'minor', 'swords', 10, 'X',
 'Ending, Bottom & the Turn After',
 ARRAY['Ending', 'Release', 'Low Point', 'Renewal'], 'Air',
 'Something may be thoroughly over. The Ten of Swords suggests that an ending this complete leaves nothing further to dread.',
 'Recovery may be beginning. One possible interpretation is that you are already further from it than you feel.',
 NULL),

('page-of-swords', 'Page of Swords', 'minor', 'swords', 11, 'XI',
 'Curiosity, Questions & Watchfulness',
 ARRAY['Curiosity', 'Vigilance', 'Questions', 'Learning'], 'Air',
 'A question may be worth asking directly. The Page of Swords suggests curiosity used honestly rather than defensively.',
 'Watchfulness may have become suspicion. This card invites you to ask rather than assume.',
 NULL),

('knight-of-swords', 'Knight of Swords', 'minor', 'swords', 12, 'XII',
 'Urgency, Directness & Fast Thought',
 ARRAY['Urgency', 'Directness', 'Ambition', 'Haste'], 'Air',
 'You may want to move now and explain later. This card suggests directness, tempered by one moment of consideration.',
 'Speed may be outpacing judgement. One possible reading is that a pause would cost you nothing.',
 NULL),

('queen-of-swords', 'Queen of Swords', 'minor', 'swords', 13, 'XIII',
 'Clarity, Independence & Honest Perception',
 ARRAY['Clarity', 'Independence', 'Perception', 'Honesty'], 'Air',
 'You may see the situation very clearly. The Queen of Swords suggests honesty delivered with warmth as well as accuracy.',
 'Clear sight may be tipping into coldness. This card invites you to let understanding soften the verdict.',
 NULL),

('king-of-swords', 'King of Swords', 'minor', 'swords', 14, 'XIV',
 'Judgement, Principle & Clear Authority',
 ARRAY['Judgement', 'Principle', 'Reason', 'Authority'], 'Air',
 'A decision may need principle rather than preference. This card suggests reasoning you would be willing to explain aloud.',
 'Reason may be serving a position rather than the truth. One possible interpretation is that certainty has outrun the evidence.',
 NULL),

-- ===========================================================================
-- PENTACLES (14) - earth, body, work, resources, patience
-- ===========================================================================
('ace-of-pentacles', 'Ace of Pentacles', 'minor', 'pentacles', 1, 'I',
 'Ground, Offer & Practical Beginning',
 ARRAY['Opportunity', 'Grounding', 'Beginning', 'Resource'], 'Earth',
 'Something practical may be offered. The Ace of Pentacles suggests a beginning with real ground beneath it.',
 'An opportunity may need better timing. This card invites you to check the foundation before building on it.',
 NULL),

('two-of-pentacles', 'Two of Pentacles', 'minor', 'pentacles', 2, 'II',
 'Juggling, Balance & Shifting Weight',
 ARRAY['Balance', 'Adaptability', 'Priorities', 'Flexibility'], 'Earth',
 'You may be managing more than one thing well. This card suggests flexibility rather than perfect balance.',
 'Something may be slipping. One possible reading is that one commitment fewer would make the rest possible.',
 NULL),

('three-of-pentacles', 'Three of Pentacles', 'minor', 'pentacles', 3, 'III',
 'Craft, Collaboration & Skilled Work',
 ARRAY['Craft', 'Collaboration', 'Skill', 'Building'], 'Earth',
 'Work done carefully may be noticed. The Three of Pentacles suggests building alongside others rather than alone.',
 'Effort may be uncoordinated. This card invites you to ask what everyone actually expects.',
 NULL),

('four-of-pentacles', 'Four of Pentacles', 'minor', 'pentacles', 4, 'IV',
 'Holding, Security & Closed Hands',
 ARRAY['Security', 'Holding', 'Caution', 'Control'], 'Earth',
 'You may be holding something tightly for good reason. This card invites you to notice whether the grip is still needed.',
 'Something may be ready to be released or shared. One possible interpretation is that generosity would cost less than feared.',
 NULL),

('five-of-pentacles', 'Five of Pentacles', 'minor', 'pentacles', 5, 'V',
 'Hardship, Cold & the Lit Window',
 ARRAY['Hardship', 'Endurance', 'Support', 'Isolation'], 'Earth',
 'A difficult stretch may feel isolating. The Five of Pentacles suggests that help may be nearer than it appears.',
 'Recovery may be beginning. This card invites you to accept support without treating it as a debt.',
 NULL),

('six-of-pentacles', 'Six of Pentacles', 'minor', 'pentacles', 6, 'VI',
 'Giving, Receiving & Fair Exchange',
 ARRAY['Generosity', 'Exchange', 'Support', 'Balance'], 'Earth',
 'Something may be shared in either direction. The Six of Pentacles suggests attention to whether the exchange is even.',
 'An imbalance may have become habit. This card invites honesty about what is being given and what is being expected.',
 NULL),

('seven-of-pentacles', 'Seven of Pentacles', 'minor', 'pentacles', 7, 'VII',
 'Patience, Assessment & Slow Growth',
 ARRAY['Patience', 'Assessment', 'Growth', 'Investment'], 'Earth',
 'Growth may be slower than hoped and still entirely real. This card suggests assessing without uprooting.',
 'Impatience may be tempting a premature decision. One possible reading is that the waiting is nearly over.',
 NULL),

('eight-of-pentacles', 'Eight of Pentacles', 'minor', 'pentacles', 8, 'VIII',
 'Practice, Diligence & Repetition',
 ARRAY['Diligence', 'Practice', 'Craft', 'Focus'], 'Earth',
 'Repetition may be doing quiet work. The Eight of Pentacles suggests skill built one ordinary day at a time.',
 'The work may have lost its meaning. This card invites you to ask whether it is the task or the pace that is wrong.',
 NULL),

('nine-of-pentacles', 'Nine of Pentacles', 'minor', 'pentacles', 9, 'IX',
 'Self-Reliance, Comfort & Earned Ease',
 ARRAY['Independence', 'Comfort', 'Self-Reliance', 'Ease'], 'Earth',
 'Something you built may be able to hold you now. This card suggests enjoying your own company and your own ground.',
 'Independence may be shading into isolation. One possible interpretation is that company would not threaten what you have made.',
 NULL),

('ten-of-pentacles', 'Ten of Pentacles', 'minor', 'pentacles', 10, 'X',
 'Legacy, Stability & Long Foundations',
 ARRAY['Legacy', 'Stability', 'Family', 'Security'], 'Earth',
 'Something may be built to last beyond this moment. The Ten of Pentacles suggests thinking in longer time than usual.',
 'Security may be defined too narrowly. This card invites you to ask what steadiness is actually for.',
 NULL),

('page-of-pentacles', 'Page of Pentacles', 'minor', 'pentacles', 11, 'XI',
 'Study, Beginning & Practical Curiosity',
 ARRAY['Study', 'Curiosity', 'Beginning', 'Diligence'], 'Earth',
 'A new skill or plan may be worth beginning. The Page of Pentacles suggests starting small and staying steady.',
 'Focus may be drifting. This card invites you to make the first step smaller until it becomes easy.',
 NULL),

('knight-of-pentacles', 'Knight of Pentacles', 'minor', 'pentacles', 12, 'XII',
 'Steadiness, Method & Reliable Pace',
 ARRAY['Reliability', 'Patience', 'Method', 'Persistence'], 'Earth',
 'Slow may be exactly right. The Knight of Pentacles suggests progress that is unglamorous and dependable.',
 'Steadiness may have become stuckness. One possible reading is that the routine needs one deliberate change.',
 NULL),

('queen-of-pentacles', 'Queen of Pentacles', 'minor', 'pentacles', 13, 'XIII',
 'Care, Practicality & Grounded Warmth',
 ARRAY['Nurture', 'Practicality', 'Warmth', 'Resourcefulness'], 'Earth',
 'You may be good at making other people feel looked after. The Queen of Pentacles suggests extending that same practical care inward.',
 'You may be carrying the practical weight for everyone. This card invites you to hand one thing over.',
 NULL),

('king-of-pentacles', 'King of Pentacles', 'minor', 'pentacles', 14, 'XIV',
 'Stewardship, Provision & Settled Ground',
 ARRAY['Stewardship', 'Abundance', 'Reliability', 'Mastery'], 'Earth',
 'Something may be well in hand. The King of Pentacles suggests steady stewardship rather than striving.',
 'Security may be turning into rigidity. One possible interpretation is that holding on has replaced enjoying.',
 NULL);
