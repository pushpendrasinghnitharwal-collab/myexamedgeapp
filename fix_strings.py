# -*- coding: utf-8 -*-
import io

p = 'src/data/questionBank.expanded.js'
lines = io.open(p, encoding='utf-8').read().split('\n')

def sub(old, new):
    global lines
    n = 0
    for i, l in enumerate(lines):
        if old in l:
            lines[i] = l.replace(old, new)
            n += 1
    print(('OK  ' if n else 'MISS'), old[:55], '->', n)

# inline substring fixes
sub("bar}ng को Sessionsलागत", "saamaan ko lagat")
sub("यदिppe Sessionsलागत", "yadi lagat")
sub("їіattack成本价格是多少?", "lagat mulya kya hai?")
sub("cada jeweils ${sp} रुपये में bikti हैं", "pratyek ${sp} rupaye mein bechi jati hain")
sub("(always) хани होती है", "hamesha haani hoti hai")
sub(" Fernsehen Byz =", " Sadharan byaaj =")
sub("साधारण Byz =", "Sadharan byaaj =")
sub("kul samay?", "kul samay kya hai?")
sub("एक car某段 दूरी", "ek car kisi doori")
sub("Bantें", "baantein")
sub("A का hissा क्या है?", "A ka hissa kya hai?")
sub("kul-SP yog", "x")
sub(" MAHATTAM samapavartak ", " mahattam samapavartak ")
sub("LCM × HCF =INRboth संख्याओं का inducproduct", "LCM × HCF = donon sankhyaon ka gunanphal")
sub("дв帯قات certainement", "dvitiya darje ki samikaran")
sub(" foilában arithmetic series,", " Arithmetic series,")
sub("shifthoui) — woorden: ${w} ही है।", "se shift hota hai) — iska matlab ${w} hai।")
sub("centenity doctors", "Some doctors")
sub("(Version)", "")
sub("(Paripoorna)", "(paryapt)")
sub("(tezi se)", "(tez chaal se)")
sub("Dr. B.R. Ambedkar খ toestabhyd Rocha।", "Dr. B.R. Ambedkar ne masuda samiti ki adhyakshata ki।")
sub("23 junio 1757.", "23 June 1757.")
sub("भारत की سب سے طويل Атлас?", "Bharat ki sabse lambi nadi kaun si hai?")
sub("5 juin.", "5 June.")
sub("1fly janvari 1862 se lagoo.", "1 January 1862 se lagoo.")

# full-line rewrites for R_STATIC entries (find by anchor in line)
def rew(anchor, newline):
    global lines
    for i, l in enumerate(lines):
        if anchor in l:
            lines[i] = newline
            print('REW line', i + 1, anchor[:40])
            return
    print('REW-MISS', anchor[:40])

rew("'Doctor : Hospital :: Teacher : ?'",
    "    ['r-analogy', 'easy', 'Doctor : Hospital :: Teacher : ?', 'Doctor : aspataal :: Teacher : ?', ['School', 'School', 'College', 'Office'], 0, 'A doctor works in a hospital; a teacher works in a school.', 'Doctor aspataal mein, teacher school mein kaam karta hai.'],")

rew("'Pen : Write :: Knife : ?'",
    "    ['r-analogy', 'easy', 'Pen : Write :: Knife : ?', 'Pen : likhna :: Chaku : ?', ['Cut', 'Kaatna', 'Write', 'Read'], 0, 'A pen is used to write; a knife to cut.', 'Pen se likhte hain, chaku se kaatne hain.'],")

rew("'Milk : Curd :: Grape : ?'",
    "    ['r-analogy', 'medium', 'Milk : Curd :: Grape : ?', 'Doodh : dahi :: Angur : ?', ['Wine', 'Wine', 'Juice', 'Jam'], 0, 'Curd is made from milk; wine from grapes.', 'Dahi doodh se, wine angur se banti hai.'],")

rew("'Book : Pages :: Brick : ?'",
    "    ['r-analogy', 'medium', 'Book : Pages :: Brick : ?', 'Kitab : Panne :: Brick : ?', ['Clay', 'Mitti', 'Stone', 'Wood'], 0, 'A book has pages; a brick is made of clay.', 'Kitab mein panne hote hain; brick mitti se banti hai.'],")

rew("'A is B\\\\'s mother. B is C\\\\'s sister.",
    "    ['r-blood', 'easy', \"A is B's mother. B is C's sister. How is A related to C?\", \"A, B ki maa hai. B, C ki bahan hai. A ka C se kya sambandh hai?\", ['Mother', 'Maa', 'Sister', 'Aunt'], 0, 'A is the mother of B, and B is sister of C, so A is mother of C.', 'A, B ki maa hai aur B, C ki bahan -> A, C ki maa hai.'],")

rew('only daughter of my mother',
    "    ['r-blood', 'medium', 'Pointing to a man, Rani said, \"His mother is the only daughter of my mother.\" How is Rani related to the man?', 'Ek aadmi ki taraf ishara karke Rani boli, \"Uski maa meri maa ki ekmatra beti hai.\" Rani ka us aadmi se kya sambandh hai?', ['Mother', 'Maa', 'Aunt', 'Chachi'], 0, \"Only daughter of Rani's mother is Rani herself, so Rani is the man's mother.\", 'Rani ki maa ki ekmatra beti Rani khud hai -> Rani us aadmi ki maa hai.'],")

rew("'Ravi walks 10 m North",
    "    ['r-direction', 'easy', 'Ravi walks 10 m North, then 6 m East, then 10 m South. How far is he from the start?', 'Ravi 10 mi North, phir 6 mi East, phir 10 mi South chalta hai. Starting point se kitni doori hai?', ['6 m East', '6 mi Poorv', '10 m', '16 m'], 0, 'Net displacement = 6 m East (North-South cancels).', 'Net displacement = 6 mi Poorv.'],")

rew("'A man faces East, turns 90",
    "    ['r-direction', 'medium', 'A man faces East, turns 90° clockwise, then 180°, then 90° anticlockwise. Which way does he face now?', 'Ek aadmi East ki or hai, 90° clockwise, phir 180°, phir 90° anticlockwise ghoomta hai. Ab kaun si disha mein hai?', ['West', 'Pashchim', 'North', 'East'], 0, 'East ->(90 CW) South ->(180) North ->(90 ACW) West. Final: West.', 'East -> dakshin -> uttar -> pashchim. Final: West.'],")

rew("All cats are animals",
    "    ['r-syllogism', 'medium', 'Statements: All cats are animals. All animals are living beings. Conclusion: All cats are living beings.', 'Kathan: saari billiyaan jaanvar hain. Saare jaanvar living beings hain. Nishkarsh: saari billiyaan living beings hain.', ['Follows', 'Saty hai', 'Does not follow', 'Saty nahi'], 0, 'All A are B, all B are C, hence all A are C. Follows.', 'Syllogism se follows: saari billiyaan living beings hain.'],")

rew("Some doctors are engineers",
    "    ['r-syllogism', 'hard', 'Statements: Some doctors are engineers. No engineer is a teacher. Conclusion: Some doctors are not teachers.', 'Kathan: kuch doctors engineers hain. Koi engineer teacher nahi. Nishkarsh: kuch doctors teacher nahi hain.', ['Follows', 'Saty hai', 'Does not follow', 'Saty nahi'], 0, 'Those doctors who are engineers cannot be teachers, so some doctors are not teachers. Follows.', 'Jo doctors engineers hain woh teacher nahi ho sakte -> follows.'],")

rew("'Five friends sit in a row",
    "    ['r-seating', 'medium', 'Five friends sit in a row facing North: A, B, C, D, E. B sits in the middle. A is at one end. Who sits at the other end?', 'Paanch dost North ki or muh karke baithe: A, B, C, D, E. B middle mein, A ek chhor par. Doosre chhor par kaun baithta hai?', ['E', 'E', 'D ya E', 'C'], 3, 'With B in the middle and A at one end, the other end is E (per the given arrangement).', 'B middle mein, A ek chhor par -> doosre chhor par E.'],")

rew("'In a family of 6",
    "    ['r-puzzle', 'hard', 'In a family of 6: P is Q father, Q is R brother, R is S mother, S is T sister, T is U father. Minimum how many males?', '6 members ke family mein: P, Q ka pita, Q, R ka bhai, R, S ki maa, S, T ki bahan, T, U ka pita. Kam se kam kitne mard?', ['3', '3', '2', '4'], 0, 'P (M), Q (M), T (M) are certainly male -> at least 3 males.', 'Kam se kam 3 mard (P, Q, T).'],")

rew("'Which Article guarantees equality",
    "    ['d-gndr', 'medium', TEACH, 'Which Article prohibits discrimination on grounds of sex?', 'Kaunsa Article sex ke aadhar par bhedbhaav rokne ki guarantee deta hai?', ['Article 15', 'Anu. 15', 'Article 14', 'Article 21'], 0, 'Article 15 prohibits discrimination on grounds including sex.', 'Anuched 15.'],")

io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('written')
