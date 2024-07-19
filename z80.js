//modifisert z80 processor, 8 bit, en byte om gangen
//takler 16-bit address buss
//instruksjoner er imellom en og tre bytes

Z80 = {
    //Tidsklokker, processoren har to, m og t
    _clock: {m:0, t:0},

    //Registre
    _r: {
        a:0, b:0, c:0, d:0, e:0, h:0, l:0, f:0, // en byte hver, kan holde en verdi fra 0 til 255.
        pc: 0, sp:0,
        m:0, t:0
    }


    //f er en flagg register, z80 har fire flagg,
    // 0x80, Hvis siste operasjon produserte 0
    // 0x40, hvis siste operasjon var substraksjon,
    // 0x20, hvis operasjonen skapte bitsskifte fra 0-3 til 4-7
    // 0x10, hvis operasjonen produserte ekstreme verdier over forventningene,255 < x < 0

    //Legger til E til A, og lar igjen resultatet i A (ADD A, E)
    ADDr_e: function() {
        Z80._r.a += Z80._r.e; // operasjonen
        Z80._r.f = 0; // Sletter flagg
        if(!(Z80._r.a & 255)) Z80._r.f |= 0x80; // Sjekker for 0
        if(Z80._r.a > 255) Z80._r.f |= 0x10; // Sjekker for ekstreme verdier
        Z80._r.a &= 255; //forsikrer at det ikke overstiger 8 bits.
        Z80._r.m = 1; Z80._r.t = 4; // en machine cycle og 4 clock cycles.
    }

    CPr_b: function () {
        var i = Z80._r.a;
        i -= Z80._r.b;
        Z80._r.f |= 0x40;
        if(!(i&255)) Z80._r.f |= 0x80;
        if(i<0) Z80._r.f |= 0x10;
        Z80._r.m = 1; Z80._r.t = 4;
    }

    NOP: function () {
        Z80._r.m=1; Z80._r.t=4;
    }
};