//modifisert z80 processor, 8 bit, en byte om gangen
//takler 16-bit address buss
//instruksjoner er imellom en og tre bytes
//laget etter instruksene til Imran Nazar, fra https://imrannazar.com/series/gameboy-emulation-in-javascript/cpu
//en god del av disse operasjonene har ikke blitt beskrevet, hentet inn og gikk gjennom etter gruppering
//disse operasjonene er allerede konstruert av prosessoren, var nødvendig for å hente dem inn for å kunne få velfungerende emulator

Z80 = {

    //Registre
    _r: {
        a:0, b:0, c:0, d:0, e:0, h:0, l:0, f:0, // en byte hver, kan holde en verdi fra 0 til 255.
        pc: 0, sp:0, i:0, r:0,
        m:0, t:0,
        ime:0 // register for maskinavbrudd, hvis 1 stopper cpuen operasjon og går til abruddshånteringsrutine og hvis 0 ingen stopp bare kjør
    },
    //f er en flagg register, z80 har fire flagg,
    // 0x80, Hvis siste operasjon produserte 0
    // 0x40, hvis siste operasjon var substraksjon,
    // 0x20, hvis operasjonen skapte bitsskifte fra 0-3 til 4-7
    // 0x10, hvis operasjonen produserte ekstreme verdier over forventningene,255 < x < 0

    //Tidsklokker, processoren har to, m og t
    _clock: {m:0, t:0},

    _halt: 0,
    _stop: 0,

    reset: function() {
        Z80._r.a=0; Z80._r.b=0; Z80._r.c=0; Z80._r.d=0; Z80._r.e=0; Z80._r.h=0; Z80._r.l=0; Z80._r.f=0;
        Z80._r.sp=0; Z80._r.pc=0; Z80._r.i=0; Z80._r.r=0;
        Z80._r.m=0; Z80._r.t=0;
        Z80._halt=0; Z80._stop=0;
        Z80._clock.m=0; Z80._clock.t=0;
        Z80._r.ime=1;
    },
    exec: function() {
        Z80._r.r = (Z80._r.r+1) & 127; // Øker R-registeret med 1 og begrenser det til 7-biter (0-127), da r er refresh teller
        Z80._map[MMU.rb(Z80._r.pc++)](); // Hent neste instruksjon fra minnet via PC og utfør instruksjonen
        Z80._r.pc &= 65535; // Begrens PC til 16-bits verdi (0x0000 - 0xFFFF) for å holde det innenfor minneområdet
        Z80._clock.m += Z80._r.m; Z80._clock.t += Z80._r.t; // Legg til antall maskinsykluser og klokkesykluser til det totale klokketelleren
        if(MMU._inbios && Z80._r.pc == 0x0100) MMU._inbios=0; // Hvis vi er i BIOS-modus og PC har nådd 0x0100, avslutt BIOS-modus, unngår === med vilje for løs sammenligning
    },
    _ops: {
        // Les to bytes fra programminnet for å lage en 16-bits adresse, og les deretter en byte fra den adressen og lagre i A (LD A, addr)
        LDAmm:function () {
            var addr = MMU.rw(Z80._r.pc);              // hent adressen fra pc, henter to byte 0x1000 og 0x1001
            Z80._r.pc += 2;                            // gå oppover i pc med 2 for å gå videre til neste instruksjon 0x1002
            Z80._r.a = MMU.rb(addr);                   // Lagre data fra addr i A(akkumulatoren)
            Z80._r.m = 4; Z80._r.t=16;
        },
        // Disse laster inn instruksjoner imellom ulike registre, og kopierer fra en register til en annen.
        LDrr_bb: function() { Z80._r.b=Z80._r.b; Z80._r.m=1; Z80._r.t=4; },
        LDrr_bc: function() { Z80._r.b=Z80._r.c; Z80._r.m=1; Z80._r.t=4; },
        LDrr_bd: function() { Z80._r.b=Z80._r.d; Z80._r.m=1; Z80._r.t=4; },
        LDrr_be: function() { Z80._r.b=Z80._r.e; Z80._r.m=1; Z80._r.t=4; },
        LDrr_bh: function() { Z80._r.b=Z80._r.h; Z80._r.m=1; Z80._r.t=4; },
        LDrr_bl: function() { Z80._r.b=Z80._r.l; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ba: function() { Z80._r.b=Z80._r.a; Z80._r.m=1; Z80._r.t=4; },
        LDrr_cb: function() { Z80._r.c=Z80._r.b; Z80._r.m=1; Z80._r.t=4; },
        LDrr_cc: function() { Z80._r.c=Z80._r.c; Z80._r.m=1; Z80._r.t=4; },
        LDrr_cd: function() { Z80._r.c=Z80._r.d; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ce: function() { Z80._r.c=Z80._r.e; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ch: function() { Z80._r.c=Z80._r.h; Z80._r.m=1; Z80._r.t=4; },
        LDrr_cl: function() { Z80._r.c=Z80._r.l; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ca: function() { Z80._r.c=Z80._r.a; Z80._r.m=1; Z80._r.t=4; },
        LDrr_db: function() { Z80._r.d=Z80._r.b; Z80._r.m=1; Z80._r.t=4; },
        LDrr_dc: function() { Z80._r.d=Z80._r.c; Z80._r.m=1; Z80._r.t=4; },
        LDrr_dd: function() { Z80._r.d=Z80._r.d; Z80._r.m=1; Z80._r.t=4; },
        LDrr_de: function() { Z80._r.d=Z80._r.e; Z80._r.m=1; Z80._r.t=4; },
        LDrr_dh: function() { Z80._r.d=Z80._r.h; Z80._r.m=1; Z80._r.t=4; },
        LDrr_dl: function() { Z80._r.d=Z80._r.l; Z80._r.m=1; Z80._r.t=4; },
        LDrr_da: function() { Z80._r.d=Z80._r.a; Z80._r.m=1; Z80._r.t=4; },
        LDrr_eb: function() { Z80._r.e=Z80._r.b; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ec: function() { Z80._r.e=Z80._r.c; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ed: function() { Z80._r.e=Z80._r.d; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ee: function() { Z80._r.e=Z80._r.e; Z80._r.m=1; Z80._r.t=4; },
        LDrr_eh: function() { Z80._r.e=Z80._r.h; Z80._r.m=1; Z80._r.t=4; },
        LDrr_el: function() { Z80._r.e=Z80._r.l; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ea: function() { Z80._r.e=Z80._r.a; Z80._r.m=1; Z80._r.t=4; },
        LDrr_hb: function() { Z80._r.h=Z80._r.b; Z80._r.m=1; Z80._r.t=4; },
        LDrr_hc: function() { Z80._r.h=Z80._r.c; Z80._r.m=1; Z80._r.t=4; },
        LDrr_hd: function() { Z80._r.h=Z80._r.d; Z80._r.m=1; Z80._r.t=4; },
        LDrr_he: function() { Z80._r.h=Z80._r.e; Z80._r.m=1; Z80._r.t=4; },
        LDrr_hh: function() { Z80._r.h=Z80._r.h; Z80._r.m=1; Z80._r.t=4; },
        LDrr_hl: function() { Z80._r.h=Z80._r.l; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ha: function() { Z80._r.h=Z80._r.a; Z80._r.m=1; Z80._r.t=4; },
        LDrr_lb: function() { Z80._r.l=Z80._r.b; Z80._r.m=1; Z80._r.t=4; },
        LDrr_lc: function() { Z80._r.l=Z80._r.c; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ld: function() { Z80._r.l=Z80._r.d; Z80._r.m=1; Z80._r.t=4; },
        LDrr_le: function() { Z80._r.l=Z80._r.e; Z80._r.m=1; Z80._r.t=4; },
        LDrr_lh: function() { Z80._r.l=Z80._r.h; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ll: function() { Z80._r.l=Z80._r.l; Z80._r.m=1; Z80._r.t=4; },
        LDrr_la: function() { Z80._r.l=Z80._r.a; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ab: function() { Z80._r.a=Z80._r.b; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ac: function() { Z80._r.a=Z80._r.c; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ad: function() { Z80._r.a=Z80._r.d; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ae: function() { Z80._r.a=Z80._r.e; Z80._r.m=1; Z80._r.t=4; },
        LDrr_ah: function() { Z80._r.a=Z80._r.h; Z80._r.m=1; Z80._r.t=4; },
        LDrr_al: function() { Z80._r.a=Z80._r.l; Z80._r.m=1; Z80._r.t=4; },
        LDrr_aa: function() { Z80._r.a=Z80._r.a; Z80._r.m=1; Z80._r.t=4; },

        //Laster inn data fra minneadressen som settes sammen av HL og kopierer de over til spesifikk register
        LDrHLm_b: function() { Z80._r.b=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.m=2; Z80._r.t=8; },
        LDrHLm_c: function() { Z80._r.c=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.m=2; Z80._r.t=8; },
        LDrHLm_d: function() { Z80._r.d=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.m=2; Z80._r.t=8; },
        LDrHLm_e: function() { Z80._r.e=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.m=2; Z80._r.t=8; },
        LDrHLm_h: function() { Z80._r.h=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.m=2; Z80._r.t=8; },
        LDrHLm_l: function() { Z80._r.l=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.m=2; Z80._r.t=8; },
        LDrHLm_a: function() { Z80._r.a=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.m=2; Z80._r.t=8; },

        //Laster inn data fra registerne og sender videre til minneadresse satt sammen av HL
        LDHLmr_b: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l,Z80._r.b); Z80._r.m=2; Z80._r.t=8; },
        LDHLmr_c: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l,Z80._r.c); Z80._r.m=2; Z80._r.t=8; },
        LDHLmr_d: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l,Z80._r.d); Z80._r.m=2; Z80._r.t=8; },
        LDHLmr_e: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l,Z80._r.e); Z80._r.m=2; Z80._r.t=8; },
        LDHLmr_h: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l,Z80._r.h); Z80._r.m=2; Z80._r.t=8; },
        LDHLmr_l: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l,Z80._r.l); Z80._r.m=2; Z80._r.t=8; },
        LDHLmr_a: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l,Z80._r.a); Z80._r.m=2; Z80._r.t=8; },

        //Laster inn en byte fra pc direkte til en spesifikk register
        LDrn_b: function() { Z80._r.b=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; },
        LDrn_c: function() { Z80._r.c=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; },
        LDrn_d: function() { Z80._r.d=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; },
        LDrn_e: function() { Z80._r.e=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; },
        LDrn_h: function() { Z80._r.h=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; },
        LDrn_l: function() { Z80._r.l=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; },
        LDrn_a: function() { Z80._r.a=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; },

        // Skriver en byte fra programminnet (ved PC) til adressen sammensatt av H og L
        LDHLmn: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l, MMU.rb(Z80._r.pc)); Z80._r.pc++; Z80._r.m=3; Z80._r.t=12; },

        // Skriver A-registeret til adressen sammensatt av x og x
        LDBCmA: function() { MMU.wb((Z80._r.b<<8)+Z80._r.c, Z80._r.a); Z80._r.m=2; Z80._r.t=8; },
        LDDEmA: function() { MMU.wb((Z80._r.d<<8)+Z80._r.e, Z80._r.a); Z80._r.m=2; Z80._r.t=8; },

        // Skriver A-registeret til den 16-bits adressen hentet fra programminnet ved PC
        LDmmA: function() { MMU.wb(MMU.rw(Z80._r.pc), Z80._r.a); Z80._r.pc+=2; Z80._r.m=4; Z80._r.t=16; },

        // laster verdien av stackpekeren (SP) til en gitt minneadresse:
        LDmmSP: function() {
            var addr = MMU.rw(Z80._r.pc);                       // Henter to byte fra PC som utgjør minneadressen
            Z80._r.pc += 2;                                     // Øker pc med 2 for å gå videre
            MMU.wb(addr, Z80._r.sp & 0xFF);                 // Lagrer den laveste byten av SP i minneadressen
            MMU.wb(addr + 1, (Z80._r.sp >> 8) & 0xFF); // Lagrer den høyeste byten av SP i minneadressen + 1
            Z80._r.m = 5;
            Z80._r.t = 20;
        },

        // Leser en byte fra adressen sammensatt av x og x, og lagrer den i A-registeret
        LDABCm: function() { Z80._r.a=MMU.rb((Z80._r.b<<8)+Z80._r.c); Z80._r.m=2; Z80._r.t=8; },
        LDADEm: function() { Z80._r.a=MMU.rb((Z80._r.d<<8)+Z80._r.e); Z80._r.m=2; Z80._r.t=8; },

        // Leser to byte fra programminnet og lagrer dem i x og x-registerene
        LDBCnn: function() { Z80._r.c=MMU.rb(Z80._r.pc); Z80._r.b=MMU.rb(Z80._r.pc+1); Z80._r.pc+=2; Z80._r.m=3; Z80._r.t=12; },
        LDDEnn: function() { Z80._r.e=MMU.rb(Z80._r.pc); Z80._r.d=MMU.rb(Z80._r.pc+1); Z80._r.pc+=2; Z80._r.m=3; Z80._r.t=12; },
        LDHLnn: function() { Z80._r.l=MMU.rb(Z80._r.pc); Z80._r.h=MMU.rb(Z80._r.pc+1); Z80._r.pc+=2; Z80._r.m=3; Z80._r.t=12; },

        // Leser to byte fra programminnet og lagrer dem i stackpekeren (SP)
        LDSPnn: function() { Z80._r.sp=MMU.rw(Z80._r.pc); Z80._r.pc+=2; Z80._r.m=3; Z80._r.t=12; },

        // Leser eller skriver to byte fra/til en 16-bits minneadresse (hentet fra programminnet) og flytter data mellom minne og registerpar (H, L)
        LDHLmm: function() { var i=MMU.rw(Z80._r.pc); Z80._r.pc+=2; Z80._r.l=MMU.rb(i); Z80._r.h=MMU.rb(i+1); Z80._r.m=5; Z80._r.t=20; },
        LDmmHL: function() { var i=MMU.rw(Z80._r.pc); Z80._r.pc+=2; MMU.ww(i,(Z80._r.h<<8)+Z80._r.l); Z80._r.m=5; Z80._r.t=20; },

        // Leser eller skriver data mellom A-registeret og minneadressen sammensatt av H og L, og inkrementerer eller dekrementerer H og L automatisk
        LDHLIA: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l, Z80._r.a); Z80._r.l=(Z80._r.l+1)&255; if(!Z80._r.l) Z80._r.h=(Z80._r.h+1)&255; Z80._r.m=2; Z80._r.t=8; },
        LDAHLI: function() { Z80._r.a=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.l=(Z80._r.l+1)&255; if(!Z80._r.l) Z80._r.h=(Z80._r.h+1)&255; Z80._r.m=2; Z80._r.t=8; },
        LDHLDA: function() { MMU.wb((Z80._r.h<<8)+Z80._r.l, Z80._r.a); Z80._r.l=(Z80._r.l-1)&255; if(Z80._r.l==255) Z80._r.h=(Z80._r.h-1)&255; Z80._r.m=2; Z80._r.t=8; },
        LDAHLD: function() { Z80._r.a=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.l=(Z80._r.l-1)&255; if(Z80._r.l==255) Z80._r.h=(Z80._r.h-1)&255; Z80._r.m=2; Z80._r.t=8; },

        // Leser eller skriver data mellom A-registeret og en I/O-port. I/O-porten er enten adressert av en byte etter PC eller ved innholdet i C-registeret
        LDAIOn: function() { Z80._r.a=MMU.rb(0xFF00+MMU.rb(Z80._r.pc)); Z80._r.pc++; Z80._r.m=3; Z80._r.t=12; },
        LDIOnA: function() { MMU.wb(0xFF00+MMU.rb(Z80._r.pc),Z80._r.a); Z80._r.pc++; Z80._r.m=3; Z80._r.t=12; },
        LDAIOC: function() { Z80._r.a=MMU.rb(0xFF00+Z80._r.c); Z80._r.m=2; Z80._r.t=8; },
        LDIOCA: function() { MMU.wb(0xFF00+Z80._r.c,Z80._r.a); Z80._r.m=2; Z80._r.t=8; },

        // Legger en byte fra programminnet (ved PC) til stackpekeren (SP) og lagrer resultatet i H- og L-registerene
        LDHLSPn: function() { var i=MMU.rb(Z80._r.pc); if(i>127) i=-((~i+1)&255); Z80._r.pc++; i+=Z80._r.sp; Z80._r.h=(i>>8)&255; Z80._r.l=i&255; Z80._r.m=3; Z80._r.t=12; },

        // Bytter innholdet mellom et register (B, C, D, E, H, L, A) og minneadressen sammensatt av H og L
        SWAPr_b: function() { var tr=Z80._r.b; Z80._r.b=MMU.rb((Z80._r.h<<8)+Z80._r.l); MMU.wb((Z80._r.h<<8)+Z80._r.l,tr); Z80._r.m=4; Z80._r.t=16; },
        SWAPr_c: function() { var tr=Z80._r.c; Z80._r.c=MMU.rb((Z80._r.h<<8)+Z80._r.l); MMU.wb((Z80._r.h<<8)+Z80._r.l,tr); Z80._r.m=4; Z80._r.t=16; },
        SWAPr_d: function() { var tr=Z80._r.d; Z80._r.d=MMU.rb((Z80._r.h<<8)+Z80._r.l); MMU.wb((Z80._r.h<<8)+Z80._r.l,tr); Z80._r.m=4; Z80._r.t=16; },
        SWAPr_e: function() { var tr=Z80._r.e; Z80._r.e=MMU.rb((Z80._r.h<<8)+Z80._r.l); MMU.wb((Z80._r.h<<8)+Z80._r.l,tr); Z80._r.m=4; Z80._r.t=16; },
        SWAPr_h: function() { var tr=Z80._r.h; Z80._r.h=MMU.rb((Z80._r.h<<8)+Z80._r.l); MMU.wb((Z80._r.h<<8)+Z80._r.l,tr); Z80._r.m=4; Z80._r.t=16; },
        SWAPr_l: function() { var tr=Z80._r.l; Z80._r.l=MMU.rb((Z80._r.h<<8)+Z80._r.l); MMU.wb((Z80._r.h<<8)+Z80._r.l,tr); Z80._r.m=4; Z80._r.t=16; },
        SWAPr_a: function() { var tr=Z80._r.a; Z80._r.a=MMU.rb((Z80._r.h<<8)+Z80._r.l); MMU.wb((Z80._r.h<<8)+Z80._r.l,tr); Z80._r.m=4; Z80._r.t=16; },

    //Legger E til A, og lar igjen resultatet i A (ADD A, E)
    ADDr_e: function() {
        Z80._r.a += Z80._r.e; // operasjonen
        Z80._r.f = 0; // Sletter flagg
        if(!(Z80._r.a & 255)) Z80._r.f |= 0x80; // Sjekker for 0
        if(Z80._r.a > 255) Z80._r.f |= 0x10; // Sjekker for ekstreme verdier
        Z80._r.a &= 255; //forsikrer at det ikke overstiger 8 bits.
        Z80._r.m = 1; Z80._r.t = 4; // en machine cycle og 4 clock cycles.
    },

        // Utfører addisjonsoperasjoner mellom A-registeret og et annet register, minneadresse eller en umiddelbar verdi (n)
        // Resultatet lagres i A-registeret, og flaggene oppdateres deretter (f.eks. Carry-flagget settes hvis det oppstår overflow)
        ADDr_b: function() { Z80._r.a+=Z80._r.b; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADDr_c: function() { Z80._r.a+=Z80._r.c; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADDr_d: function() { Z80._r.a+=Z80._r.d; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADDr_h: function() { Z80._r.a+=Z80._r.h; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADDr_l: function() { Z80._r.a+=Z80._r.l; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADDr_a: function() { Z80._r.a+=Z80._r.a; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADDHL: function() { Z80._r.a+=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },
        ADDn: function() { Z80._r.a+=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },
        ADDHLBC: function() { var hl=(Z80._r.h<<8)+Z80._r.l; hl+=(Z80._r.b<<8)+Z80._r.c; if(hl>65535) Z80._r.f|=0x10; else Z80._r.f&=0xEF; Z80._r.h=(hl>>8)&255; Z80._r.l=hl&255; Z80._r.m=3; Z80._r.t=12; },
        ADDHLDE: function() { var hl=(Z80._r.h<<8)+Z80._r.l; hl+=(Z80._r.d<<8)+Z80._r.e; if(hl>65535) Z80._r.f|=0x10; else Z80._r.f&=0xEF; Z80._r.h=(hl>>8)&255; Z80._r.l=hl&255; Z80._r.m=3; Z80._r.t=12; },
        ADDHLHL: function() { var hl=(Z80._r.h<<8)+Z80._r.l; hl+=(Z80._r.h<<8)+Z80._r.l; if(hl>65535) Z80._r.f|=0x10; else Z80._r.f&=0xEF; Z80._r.h=(hl>>8)&255; Z80._r.l=hl&255; Z80._r.m=3; Z80._r.t=12; },
        ADDHLSP: function() { var hl=(Z80._r.h<<8)+Z80._r.l; hl+=Z80._r.sp; if(hl>65535) Z80._r.f|=0x10; else Z80._r.f&=0xEF; Z80._r.h=(hl>>8)&255; Z80._r.l=hl&255; Z80._r.m=3; Z80._r.t=12; },
        ADDSPn: function() { var i=MMU.rb(Z80._r.pc); if(i>127) i=-((~i+1)&255); Z80._r.pc++; Z80._r.sp+=i; Z80._r.m=4; Z80._r.t=16; },

        // Utfører "addisjon med carry" (ADC) mellom A-registeret og et annet register, en minneadresse eller en umiddelbar verdi (n)
        // I tillegg til vanlig addisjon, legges carry-flagget (hvis satt) fra forrige operasjon til i beregningen
        // Resultatet lagres i A-registeret, og flaggene oppdateres deretter (f.eks. Carry-flagget settes hvis det oppstår overflow)
        ADCr_b: function() { Z80._r.a+=Z80._r.b; Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADCr_c: function() { Z80._r.a+=Z80._r.c; Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADCr_d: function() { Z80._r.a+=Z80._r.d; Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADCr_e: function() { Z80._r.a+=Z80._r.e; Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADCr_h: function() { Z80._r.a+=Z80._r.h; Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADCr_l: function() { Z80._r.a+=Z80._r.l; Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADCr_a: function() { Z80._r.a+=Z80._r.a; Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        ADCHL: function() { Z80._r.a+=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },
        ADCn: function() { Z80._r.a+=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.a+=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a); if(Z80._r.a>255) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },

        // Utfører subtraksjon (SUB) mellom A-registeret og et annet register, en minneadresse eller en umiddelbar verdi (n)
        // Resultatet lagres i A-registeret, og flaggene oppdateres deretter. Z-flagget settes hvis resultatet er null
        // og Carry-flagget settes hvis resultatet er negativt (underflow)
        SUBr_b: function() { Z80._r.a-=Z80._r.b; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SUBr_c: function() { Z80._r.a-=Z80._r.c; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SUBr_d: function() { Z80._r.a-=Z80._r.d; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SUBr_e: function() { Z80._r.a-=Z80._r.e; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SUBr_h: function() { Z80._r.a-=Z80._r.h; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SUBr_l: function() { Z80._r.a-=Z80._r.l; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SUBr_a: function() { Z80._r.a-=Z80._r.a; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SUBHL: function() { Z80._r.a-=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },
        SUBn: function() { Z80._r.a-=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },

        // Utfører subtraksjon med carry (SBC) mellom A-registeret og et annet register, en minneadresse eller en umiddelbar verdi (n)
        // I tillegg til vanlig subtraksjon, trekkes carry-flagget (hvis satt) fra forrige operasjon også fra i beregningen
        // Resultatet lagres i A-registeret, og flaggene oppdateres deretter. Z-flagget settes hvis resultatet er null
        // og Carry-flagget settes hvis resultatet er negativt (underflow)
        SBCr_b: function() { Z80._r.a-=Z80._r.b; Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SBCr_c: function() { Z80._r.a-=Z80._r.c; Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SBCr_d: function() { Z80._r.a-=Z80._r.d; Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SBCr_e: function() { Z80._r.a-=Z80._r.e; Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SBCr_h: function() { Z80._r.a-=Z80._r.h; Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SBCr_l: function() { Z80._r.a-=Z80._r.l; Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SBCr_a: function() { Z80._r.a-=Z80._r.a; Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=1; Z80._r.t=4; },
        SBCHL: function() { Z80._r.a-=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },
        SBCn: function() { Z80._r.a-=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.a-=(Z80._r.f&0x10)?1:0; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },

        //Sammenligner B og A, flagger underveis
        CPr_b: function () {
            var i = Z80._r.a; // Lagre verdien av A-registeret i variabelen 'i'
            i -= Z80._r.b; // Utfør en subtraksjon: trekk verdien av B-registeret fra A-registeret uten å lagre resultatet
            Z80._r.f |= 0x40; // Sett "N" flagget i flaggregisteret (f = 0x40), som indikerer at en subtraksjon er utført
            if(!(i&255)) Z80._r.f |= 0x80;// Hvis resultatet (i) er 0 når maskert med 255 (dvs. det er lik 0), sett Zero-flagget (f = 0x80)
            if(i<0) Z80._r.f |= 0x10;// Hvis resultatet er negativt (i < 0), sett Carry-flagget (f = 0x10)
            Z80._r.m = 1; Z80._r.t = 4; // Instruksjonen tar 1 maskinsyklus (M-cycle) og 4 klokkesykluser (T-states) å fullføre
        },

        // Utfører en sammenligning (CP) mellom A-registeret og et annet register, en minneadresse eller en umiddelbar verdi (n)
        // Sammenligningen utføres ved å subtrahere verdien fra A-registeret, men resultatet lagres ikke i A-registeret
        // Flaggene oppdateres som om en subtraksjon ble utført, inkludert Z-flagget (nullresultat) og Carry-flagget (hvis A er mindre enn verdien)
        CPr_c: function() { var i=Z80._r.a; i-=Z80._r.c; Z80._ops.fz(i,1); if(i<0) Z80._r.f|=0x10; i&=255; Z80._r.m=1; Z80._r.t=4; },
        CPr_d: function() { var i=Z80._r.a; i-=Z80._r.d; Z80._ops.fz(i,1); if(i<0) Z80._r.f|=0x10; i&=255; Z80._r.m=1; Z80._r.t=4; },
        CPr_e: function() { var i=Z80._r.a; i-=Z80._r.e; Z80._ops.fz(i,1); if(i<0) Z80._r.f|=0x10; i&=255; Z80._r.m=1; Z80._r.t=4; },
        CPr_h: function() { var i=Z80._r.a; i-=Z80._r.h; Z80._ops.fz(i,1); if(i<0) Z80._r.f|=0x10; i&=255; Z80._r.m=1; Z80._r.t=4; },
        CPr_l: function() { var i=Z80._r.a; i-=Z80._r.l; Z80._ops.fz(i,1); if(i<0) Z80._r.f|=0x10; i&=255; Z80._r.m=1; Z80._r.t=4; },
        CPr_a: function() { var i=Z80._r.a; i-=Z80._r.a; Z80._ops.fz(i,1); if(i<0) Z80._r.f|=0x10; i&=255; Z80._r.m=1; Z80._r.t=4; },
        CPHL: function() { var i=Z80._r.a; i-=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._ops.fz(i,1); if(i<0) Z80._r.f|=0x10; i&=255; Z80._r.m=2; Z80._r.t=8; },
        CPn: function() { var i=Z80._r.a; i-=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._ops.fz(i,1); if(i<0) Z80._r.f|=0x10; i&=255; Z80._r.m=2; Z80._r.t=8; },

        // Utfører en bitvis AND-operasjon mellom A-registeret og et annet register, en minneadresse eller en umiddelbar verdi (n)
        // Resultatet lagres i A-registeret, og flaggene oppdateres deretter, inkludert Z-flagget (settes hvis resultatet er null)
        // Carry-flagget settes ikke, siden AND-instruksjonen ikke påvirker Carry-flagget
        ANDr_b: function() { Z80._r.a&=Z80._r.b; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ANDr_c: function() { Z80._r.a&=Z80._r.c; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ANDr_d: function() { Z80._r.a&=Z80._r.d; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ANDr_e: function() { Z80._r.a&=Z80._r.e; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ANDr_h: function() { Z80._r.a&=Z80._r.h; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ANDr_l: function() { Z80._r.a&=Z80._r.l; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ANDr_a: function() { Z80._r.a&=Z80._r.a; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ANDHL: function() { Z80._r.a&=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=2; Z80._r.t=8; },
        ANDn: function() { Z80._r.a&=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=2; Z80._r.t=8; },

        // Utfører en bitvis OR-operasjon mellom A-registeret og et annet register, en minneadresse eller en umiddelbar verdi (n)
        // Resultatet lagres i A-registeret, og flaggene oppdateres deretter, inkludert Z-flagget (settes hvis resultatet er null)
        // Carry-flagget påvirkes ikke av OR-instruksjonen, da den ikke påvirker Carry-flagget
        ORr_b: function() { Z80._r.a|=Z80._r.b; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ORr_c: function() { Z80._r.a|=Z80._r.c; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ORr_d: function() { Z80._r.a|=Z80._r.d; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ORr_e: function() { Z80._r.a|=Z80._r.e; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ORr_h: function() { Z80._r.a|=Z80._r.h; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ORr_l: function() { Z80._r.a|=Z80._r.l; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ORr_a: function() { Z80._r.a|=Z80._r.a; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        ORHL: function() { Z80._r.a|=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=2; Z80._r.t=8; },
        ORn: function() { Z80._r.a|=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=2; Z80._r.t=8; },

        // Utfører en bitvis XOR-operasjon mellom A-registeret og et annet register, en minneadresse eller en umiddelbar verdi (n)
        // Resultatet lagres i A-registeret, og flaggene oppdateres deretter, inkludert Z-flagget (settes hvis resultatet er null)
        // XOR-instruksjonen påvirker ikke Carry-flagget
        XORr_b: function() { Z80._r.a^=Z80._r.b; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        XORr_c: function() { Z80._r.a^=Z80._r.c; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        XORr_d: function() { Z80._r.a^=Z80._r.d; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        XORr_e: function() { Z80._r.a^=Z80._r.e; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        XORr_h: function() { Z80._r.a^=Z80._r.h; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        XORr_l: function() { Z80._r.a^=Z80._r.l; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        XORr_a: function() { Z80._r.a^=Z80._r.a; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        XORHL: function() { Z80._r.a^=MMU.rb((Z80._r.h<<8)+Z80._r.l); Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=2; Z80._r.t=8; },
        XORn: function() { Z80._r.a^=MMU.rb(Z80._r.pc); Z80._r.pc++; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=2; Z80._r.t=8; },

        // Utfører en inkrementeringsoperasjon (INC) som øker innholdet i et register, eller verdien i en minneadresse (HL), med 1
        // Resultatet lagres tilbake i registeret eller minneadressen, og flaggene oppdateres deretter (f.eks. Z-flagget settes hvis resultatet er null)
        // Carry-flagget påvirkes ikke av inkrementeringsoperasjonen
        INCr_b: function() { Z80._r.b++; Z80._r.b&=255; Z80._ops.fz(Z80._r.b); Z80._r.m=1; Z80._r.t=4; },
        INCr_c: function() { Z80._r.c++; Z80._r.c&=255; Z80._ops.fz(Z80._r.c); Z80._r.m=1; Z80._r.t=4; },
        INCr_d: function() { Z80._r.d++; Z80._r.d&=255; Z80._ops.fz(Z80._r.d); Z80._r.m=1; Z80._r.t=4; },
        INCr_e: function() { Z80._r.e++; Z80._r.e&=255; Z80._ops.fz(Z80._r.e); Z80._r.m=1; Z80._r.t=4; },
        INCr_h: function() { Z80._r.h++; Z80._r.h&=255; Z80._ops.fz(Z80._r.h); Z80._r.m=1; Z80._r.t=4; },
        INCr_l: function() { Z80._r.l++; Z80._r.l&=255; Z80._ops.fz(Z80._r.l); Z80._r.m=1; Z80._r.t=4; },
        INCr_a: function() { Z80._r.a++; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        INCHLm: function() { var i=MMU.rb((Z80._r.h<<8)+Z80._r.l)+1; i&=255; MMU.wb((Z80._r.h<<8)+Z80._r.l,i); Z80._ops.fz(i); Z80._r.m=3; Z80._r.t=12; },

        // Utfører en dekrementeringsoperasjon (DEC) som reduserer innholdet i et register, eller verdien i en minneadresse (HL), med 1
        // Resultatet lagres tilbake i registeret eller minneadressen, og flaggene oppdateres deretter (f.eks. Z-flagget settes hvis resultatet er null)
        // Carry-flagget påvirkes ikke av dekrementeringsoperasjonen
        DECr_b: function() { Z80._r.b--; Z80._r.b&=255; Z80._ops.fz(Z80._r.b); Z80._r.m=1; Z80._r.t=4; },
        DECr_c: function() { Z80._r.c--; Z80._r.c&=255; Z80._ops.fz(Z80._r.c); Z80._r.m=1; Z80._r.t=4; },
        DECr_d: function() { Z80._r.d--; Z80._r.d&=255; Z80._ops.fz(Z80._r.d); Z80._r.m=1; Z80._r.t=4; },
        DECr_e: function() { Z80._r.e--; Z80._r.e&=255; Z80._ops.fz(Z80._r.e); Z80._r.m=1; Z80._r.t=4; },
        DECr_h: function() { Z80._r.h--; Z80._r.h&=255; Z80._ops.fz(Z80._r.h); Z80._r.m=1; Z80._r.t=4; },
        DECr_l: function() { Z80._r.l--; Z80._r.l&=255; Z80._ops.fz(Z80._r.l); Z80._r.m=1; Z80._r.t=4; },
        DECr_a: function() { Z80._r.a--; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.m=1; Z80._r.t=4; },
        DECHLm: function() { var i=MMU.rb((Z80._r.h<<8)+Z80._r.l)-1; i&=255; MMU.wb((Z80._r.h<<8)+Z80._r.l,i); Z80._ops.fz(i); Z80._r.m=3; Z80._r.t=12; },

        // Utfører en inkrementeringsoperasjon (INC) på registerparene (BC, DE, HL) eller stackpekeren (SP), som øker verdien med 1
        // For registerparene, når den lavere byten (C, E, L) overflyter fra 255 til 0, økes den høyere byten (B, D, H)
        // For SP (stackpekeren), den øker direkte med 1 uten spesielle betingelser
        INCBC: function() { Z80._r.c=(Z80._r.c+1)&255; if(!Z80._r.c) Z80._r.b=(Z80._r.b+1)&255; Z80._r.m=1; Z80._r.t=4; },
        INCDE: function() { Z80._r.e=(Z80._r.e+1)&255; if(!Z80._r.e) Z80._r.d=(Z80._r.d+1)&255; Z80._r.m=1; Z80._r.t=4; },
        INCHL: function() { Z80._r.l=(Z80._r.l+1)&255; if(!Z80._r.l) Z80._r.h=(Z80._r.h+1)&255; Z80._r.m=1; Z80._r.t=4; },
        INCSP: function() { Z80._r.sp=(Z80._r.sp+1)&65535; Z80._r.m=1; Z80._r.t=4; },

        // Utfører en dekrementeringsoperasjon (DEC) på registerparene (BC, DE, HL) eller stackpekeren (SP), som reduserer verdien med 1
        // For registerparene, når den lavere byten (C, E, L) underflyter fra 0 til 255, reduseres den høyere byten (B, D, H)
        // For SP (stackpekeren), den reduseres direkte med 1 uten spesielle betingelser
        DECBC: function() { Z80._r.c=(Z80._r.c-1)&255; if(Z80._r.c==255) Z80._r.b=(Z80._r.b-1)&255; Z80._r.m=1; Z80._r.t=4; },
        DECDE: function() { Z80._r.e=(Z80._r.e-1)&255; if(Z80._r.e==255) Z80._r.d=(Z80._r.d-1)&255; Z80._r.m=1; Z80._r.t=4; },
        DECHL: function() { Z80._r.l=(Z80._r.l-1)&255; if(Z80._r.l==255) Z80._r.h=(Z80._r.h-1)&255; Z80._r.m=1; Z80._r.t=4; },
        DECSP: function() { Z80._r.sp=(Z80._r.sp-1)&65535; Z80._r.m=1; Z80._r.t=4; },

        // Utfører en BIT-test på en spesifikk bit (0 til 7) i et register eller minneadresse (HL)
        // Bit-testen sjekker om en bestemt bit i registeret/minneadressen er satt (1) eller ikke (0), uten å endre innholdet i registeret
        // Resultatet oppdaterer flaggene, spesielt Z-flagget, som settes hvis den testede biten er null
        BIT0b: function() { Z80._ops.fz(Z80._r.b&0x01); Z80._r.m=2; Z80._r.t=8; },
        BIT0c: function() { Z80._ops.fz(Z80._r.c&0x01); Z80._r.m=2; Z80._r.t=8; },
        BIT0d: function() { Z80._ops.fz(Z80._r.d&0x01); Z80._r.m=2; Z80._r.t=8; },
        BIT0e: function() { Z80._ops.fz(Z80._r.e&0x01); Z80._r.m=2; Z80._r.t=8; },
        BIT0h: function() { Z80._ops.fz(Z80._r.h&0x01); Z80._r.m=2; Z80._r.t=8; },
        BIT0l: function() { Z80._ops.fz(Z80._r.l&0x01); Z80._r.m=2; Z80._r.t=8; },
        BIT0a: function() { Z80._ops.fz(Z80._r.a&0x01); Z80._r.m=2; Z80._r.t=8; },
        BIT0m: function() { Z80._ops.fz(MMU.rb((Z80._r.h<<8)+Z80._r.l)&0x01); Z80._r.m=3; Z80._r.t=12; },

        BIT1b: function() { Z80._ops.fz(Z80._r.b&0x02); Z80._r.m=2; Z80._r.t=8; },
        BIT1c: function() { Z80._ops.fz(Z80._r.c&0x02); Z80._r.m=2; Z80._r.t=8; },
        BIT1d: function() { Z80._ops.fz(Z80._r.d&0x02); Z80._r.m=2; Z80._r.t=8; },
        BIT1e: function() { Z80._ops.fz(Z80._r.e&0x02); Z80._r.m=2; Z80._r.t=8; },
        BIT1h: function() { Z80._ops.fz(Z80._r.h&0x02); Z80._r.m=2; Z80._r.t=8; },
        BIT1l: function() { Z80._ops.fz(Z80._r.l&0x02); Z80._r.m=2; Z80._r.t=8; },
        BIT1a: function() { Z80._ops.fz(Z80._r.a&0x02); Z80._r.m=2; Z80._r.t=8; },
        BIT1m: function() { Z80._ops.fz(MMU.rb((Z80._r.h<<8)+Z80._r.l)&0x02); Z80._r.m=3; Z80._r.t=12; },

        BIT2b: function() { Z80._ops.fz(Z80._r.b&0x04); Z80._r.m=2; Z80._r.t=8; },
        BIT2c: function() { Z80._ops.fz(Z80._r.c&0x04); Z80._r.m=2; Z80._r.t=8; },
        BIT2d: function() { Z80._ops.fz(Z80._r.d&0x04); Z80._r.m=2; Z80._r.t=8; },
        BIT2e: function() { Z80._ops.fz(Z80._r.e&0x04); Z80._r.m=2; Z80._r.t=8; },
        BIT2h: function() { Z80._ops.fz(Z80._r.h&0x04); Z80._r.m=2; Z80._r.t=8; },
        BIT2l: function() { Z80._ops.fz(Z80._r.l&0x04); Z80._r.m=2; Z80._r.t=8; },
        BIT2a: function() { Z80._ops.fz(Z80._r.a&0x04); Z80._r.m=2; Z80._r.t=8; },
        BIT2m: function() { Z80._ops.fz(MMU.rb((Z80._r.h<<8)+Z80._r.l)&0x04); Z80._r.m=3; Z80._r.t=12; },

        BIT3b: function() { Z80._ops.fz(Z80._r.b&0x08); Z80._r.m=2; Z80._r.t=8; },
        BIT3c: function() { Z80._ops.fz(Z80._r.c&0x08); Z80._r.m=2; Z80._r.t=8; },
        BIT3d: function() { Z80._ops.fz(Z80._r.d&0x08); Z80._r.m=2; Z80._r.t=8; },
        BIT3e: function() { Z80._ops.fz(Z80._r.e&0x08); Z80._r.m=2; Z80._r.t=8; },
        BIT3h: function() { Z80._ops.fz(Z80._r.h&0x08); Z80._r.m=2; Z80._r.t=8; },
        BIT3l: function() { Z80._ops.fz(Z80._r.l&0x08); Z80._r.m=2; Z80._r.t=8; },
        BIT3a: function() { Z80._ops.fz(Z80._r.a&0x08); Z80._r.m=2; Z80._r.t=8; },
        BIT3m: function() { Z80._ops.fz(MMU.rb((Z80._r.h<<8)+Z80._r.l)&0x08); Z80._r.m=3; Z80._r.t=12; },

        BIT4b: function() { Z80._ops.fz(Z80._r.b&0x10); Z80._r.m=2; Z80._r.t=8; },
        BIT4c: function() { Z80._ops.fz(Z80._r.c&0x10); Z80._r.m=2; Z80._r.t=8; },
        BIT4d: function() { Z80._ops.fz(Z80._r.d&0x10); Z80._r.m=2; Z80._r.t=8; },
        BIT4e: function() { Z80._ops.fz(Z80._r.e&0x10); Z80._r.m=2; Z80._r.t=8; },
        BIT4h: function() { Z80._ops.fz(Z80._r.h&0x10); Z80._r.m=2; Z80._r.t=8; },
        BIT4l: function() { Z80._ops.fz(Z80._r.l&0x10); Z80._r.m=2; Z80._r.t=8; },
        BIT4a: function() { Z80._ops.fz(Z80._r.a&0x10); Z80._r.m=2; Z80._r.t=8; },
        BIT4m: function() { Z80._ops.fz(MMU.rb((Z80._r.h<<8)+Z80._r.l)&0x10); Z80._r.m=3; Z80._r.t=12; },

        BIT5b: function() { Z80._ops.fz(Z80._r.b&0x20); Z80._r.m=2; Z80._r.t=8; },
        BIT5c: function() { Z80._ops.fz(Z80._r.c&0x20); Z80._r.m=2; Z80._r.t=8; },
        BIT5d: function() { Z80._ops.fz(Z80._r.d&0x20); Z80._r.m=2; Z80._r.t=8; },
        BIT5e: function() { Z80._ops.fz(Z80._r.e&0x20); Z80._r.m=2; Z80._r.t=8; },
        BIT5h: function() { Z80._ops.fz(Z80._r.h&0x20); Z80._r.m=2; Z80._r.t=8; },
        BIT5l: function() { Z80._ops.fz(Z80._r.l&0x20); Z80._r.m=2; Z80._r.t=8; },
        BIT5a: function() { Z80._ops.fz(Z80._r.a&0x20); Z80._r.m=2; Z80._r.t=8; },
        BIT5m: function() { Z80._ops.fz(MMU.rb((Z80._r.h<<8)+Z80._r.l)&0x20); Z80._r.m=3; Z80._r.t=12; },

        BIT6b: function() { Z80._ops.fz(Z80._r.b&0x40); Z80._r.m=2; Z80._r.t=8; },
        BIT6c: function() { Z80._ops.fz(Z80._r.c&0x40); Z80._r.m=2; Z80._r.t=8; },
        BIT6d: function() { Z80._ops.fz(Z80._r.d&0x40); Z80._r.m=2; Z80._r.t=8; },
        BIT6e: function() { Z80._ops.fz(Z80._r.e&0x40); Z80._r.m=2; Z80._r.t=8; },
        BIT6h: function() { Z80._ops.fz(Z80._r.h&0x40); Z80._r.m=2; Z80._r.t=8; },
        BIT6l: function() { Z80._ops.fz(Z80._r.l&0x40); Z80._r.m=2; Z80._r.t=8; },
        BIT6a: function() { Z80._ops.fz(Z80._r.a&0x40); Z80._r.m=2; Z80._r.t=8; },
        BIT6m: function() { Z80._ops.fz(MMU.rb((Z80._r.h<<8)+Z80._r.l)&0x40); Z80._r.m=3; Z80._r.t=12; },

        BIT7b: function() { Z80._ops.fz(Z80._r.b&0x80); Z80._r.m=2; Z80._r.t=8; },
        BIT7c: function() { Z80._ops.fz(Z80._r.c&0x80); Z80._r.m=2; Z80._r.t=8; },
        BIT7d: function() { Z80._ops.fz(Z80._r.d&0x80); Z80._r.m=2; Z80._r.t=8; },
        BIT7e: function() { Z80._ops.fz(Z80._r.e&0x80); Z80._r.m=2; Z80._r.t=8; },
        BIT7h: function() { Z80._ops.fz(Z80._r.h&0x80); Z80._r.m=2; Z80._r.t=8; },
        BIT7l: function() { Z80._ops.fz(Z80._r.l&0x80); Z80._r.m=2; Z80._r.t=8; },
        BIT7a: function() { Z80._ops.fz(Z80._r.a&0x80); Z80._r.m=2; Z80._r.t=8; },
        BIT7m: function() { Z80._ops.fz(MMU.rb((Z80._r.h<<8)+Z80._r.l)&0x80); Z80._r.m=3; Z80._r.t=12; },

        // Utfører rotasjons- og skiftoperasjoner på et register eller verdien på en minneadresse (HL)
        // Rotasjonsoperasjoner (RL, RR, RLC, RRC) flytter bitene i registeret til venstre eller høyre, med eller uten bruk av carry-flagget
        // Resultatene lagres tilbake i registeret, og flaggene oppdateres
        RLA: function() { var ci=Z80._r.f&0x10?1:0; var co=Z80._r.a&0x80?0x10:0; Z80._r.a=(Z80._r.a<<1)+ci; Z80._r.a&=255; Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=1; Z80._r.t=4; },
        RLCA: function() { var ci=Z80._r.a&0x80?1:0; var co=Z80._r.a&0x80?0x10:0; Z80._r.a=(Z80._r.a<<1)+ci; Z80._r.a&=255; Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=1; Z80._r.t=4; },
        RRA: function() { var ci=Z80._r.f&0x10?0x80:0; var co=Z80._r.a&1?0x10:0; Z80._r.a=(Z80._r.a>>1)+ci; Z80._r.a&=255; Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=1; Z80._r.t=4; },
        RRCA: function() { var ci=Z80._r.a&1?0x80:0; var co=Z80._r.a&1?0x10:0; Z80._r.a=(Z80._r.a>>1)+ci; Z80._r.a&=255; Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=1; Z80._r.t=4; },

        RLr_b: function() { var ci=Z80._r.f&0x10?1:0; var co=Z80._r.b&0x80?0x10:0; Z80._r.b=(Z80._r.b<<1)+ci; Z80._r.b&=255; Z80._ops.fz(Z80._r.b); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLr_c: function() { var ci=Z80._r.f&0x10?1:0; var co=Z80._r.c&0x80?0x10:0; Z80._r.c=(Z80._r.c<<1)+ci; Z80._r.c&=255; Z80._ops.fz(Z80._r.c); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLr_d: function() { var ci=Z80._r.f&0x10?1:0; var co=Z80._r.d&0x80?0x10:0; Z80._r.d=(Z80._r.d<<1)+ci; Z80._r.d&=255; Z80._ops.fz(Z80._r.d); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLr_e: function() { var ci=Z80._r.f&0x10?1:0; var co=Z80._r.e&0x80?0x10:0; Z80._r.e=(Z80._r.e<<1)+ci; Z80._r.e&=255; Z80._ops.fz(Z80._r.e); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLr_h: function() { var ci=Z80._r.f&0x10?1:0; var co=Z80._r.h&0x80?0x10:0; Z80._r.h=(Z80._r.h<<1)+ci; Z80._r.h&=255; Z80._ops.fz(Z80._r.h); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLr_l: function() { var ci=Z80._r.f&0x10?1:0; var co=Z80._r.l&0x80?0x10:0; Z80._r.l=(Z80._r.l<<1)+ci; Z80._r.l&=255; Z80._ops.fz(Z80._r.l); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLr_a: function() { var ci=Z80._r.f&0x10?1:0; var co=Z80._r.a&0x80?0x10:0; Z80._r.a=(Z80._r.a<<1)+ci; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLHL: function() { var i=MMU.rb((Z80._r.h<<8)+Z80._r.l); var ci=Z80._r.f&0x10?1:0; var co=i&0x80?0x10:0; i=(i<<1)+ci; i&=255; Z80._ops.fz(i); MMU.wb((Z80._r.h<<8)+Z80._r.l,i); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=4; Z80._r.t=16; },

        RLCr_b: function() { var ci=Z80._r.b&0x80?1:0; var co=Z80._r.b&0x80?0x10:0; Z80._r.b=(Z80._r.b<<1)+ci; Z80._r.b&=255; Z80._ops.fz(Z80._r.b); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLCr_c: function() { var ci=Z80._r.c&0x80?1:0; var co=Z80._r.c&0x80?0x10:0; Z80._r.c=(Z80._r.c<<1)+ci; Z80._r.c&=255; Z80._ops.fz(Z80._r.c); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLCr_d: function() { var ci=Z80._r.d&0x80?1:0; var co=Z80._r.d&0x80?0x10:0; Z80._r.d=(Z80._r.d<<1)+ci; Z80._r.d&=255; Z80._ops.fz(Z80._r.d); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLCr_e: function() { var ci=Z80._r.e&0x80?1:0; var co=Z80._r.e&0x80?0x10:0; Z80._r.e=(Z80._r.e<<1)+ci; Z80._r.e&=255; Z80._ops.fz(Z80._r.e); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLCr_h: function() { var ci=Z80._r.h&0x80?1:0; var co=Z80._r.h&0x80?0x10:0; Z80._r.h=(Z80._r.h<<1)+ci; Z80._r.h&=255; Z80._ops.fz(Z80._r.h); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLCr_l: function() { var ci=Z80._r.l&0x80?1:0; var co=Z80._r.l&0x80?0x10:0; Z80._r.l=(Z80._r.l<<1)+ci; Z80._r.l&=255; Z80._ops.fz(Z80._r.l); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLCr_a: function() { var ci=Z80._r.a&0x80?1:0; var co=Z80._r.a&0x80?0x10:0; Z80._r.a=(Z80._r.a<<1)+ci; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RLCHL: function() { var i=MMU.rb((Z80._r.h<<8)+Z80._r.l); var ci=i&0x80?1:0; var co=i&0x80?0x10:0; i=(i<<1)+ci; i&=255; Z80._ops.fz(i); MMU.wb((Z80._r.h<<8)+Z80._r.l,i); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=4; Z80._r.t=16; },

        RRr_b: function() { var ci=Z80._r.f&0x10?0x80:0; var co=Z80._r.b&1?0x10:0; Z80._r.b=(Z80._r.b>>1)+ci; Z80._r.b&=255; Z80._ops.fz(Z80._r.b); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRr_c: function() { var ci=Z80._r.f&0x10?0x80:0; var co=Z80._r.c&1?0x10:0; Z80._r.c=(Z80._r.c>>1)+ci; Z80._r.c&=255; Z80._ops.fz(Z80._r.c); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRr_d: function() { var ci=Z80._r.f&0x10?0x80:0; var co=Z80._r.d&1?0x10:0; Z80._r.d=(Z80._r.d>>1)+ci; Z80._r.d&=255; Z80._ops.fz(Z80._r.d); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRr_e: function() { var ci=Z80._r.f&0x10?0x80:0; var co=Z80._r.e&1?0x10:0; Z80._r.e=(Z80._r.e>>1)+ci; Z80._r.e&=255; Z80._ops.fz(Z80._r.e); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRr_h: function() { var ci=Z80._r.f&0x10?0x80:0; var co=Z80._r.h&1?0x10:0; Z80._r.h=(Z80._r.h>>1)+ci; Z80._r.h&=255; Z80._ops.fz(Z80._r.h); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRr_l: function() { var ci=Z80._r.f&0x10?0x80:0; var co=Z80._r.l&1?0x10:0; Z80._r.l=(Z80._r.l>>1)+ci; Z80._r.l&=255; Z80._ops.fz(Z80._r.l); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRr_a: function() { var ci=Z80._r.f&0x10?0x80:0; var co=Z80._r.a&1?0x10:0; Z80._r.a=(Z80._r.a>>1)+ci; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRHL: function() { var i=MMU.rb((Z80._r.h<<8)+Z80._r.l); var ci=Z80._r.f&0x10?0x80:0; var co=i&1?0x10:0; i=(i>>1)+ci; i&=255; MMU.wb((Z80._r.h<<8)+Z80._r.l,i); Z80._ops.fz(i); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=4; Z80._r.t=16; },

        RRCr_b: function() { var ci=Z80._r.b&1?0x80:0; var co=Z80._r.b&1?0x10:0; Z80._r.b=(Z80._r.b>>1)+ci; Z80._r.b&=255; Z80._ops.fz(Z80._r.b); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRCr_c: function() { var ci=Z80._r.c&1?0x80:0; var co=Z80._r.c&1?0x10:0; Z80._r.c=(Z80._r.c>>1)+ci; Z80._r.c&=255; Z80._ops.fz(Z80._r.c); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRCr_d: function() { var ci=Z80._r.d&1?0x80:0; var co=Z80._r.d&1?0x10:0; Z80._r.d=(Z80._r.d>>1)+ci; Z80._r.d&=255; Z80._ops.fz(Z80._r.d); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRCr_e: function() { var ci=Z80._r.e&1?0x80:0; var co=Z80._r.e&1?0x10:0; Z80._r.e=(Z80._r.e>>1)+ci; Z80._r.e&=255; Z80._ops.fz(Z80._r.e); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRCr_h: function() { var ci=Z80._r.h&1?0x80:0; var co=Z80._r.h&1?0x10:0; Z80._r.h=(Z80._r.h>>1)+ci; Z80._r.h&=255; Z80._ops.fz(Z80._r.h); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRCr_l: function() { var ci=Z80._r.l&1?0x80:0; var co=Z80._r.l&1?0x10:0; Z80._r.l=(Z80._r.l>>1)+ci; Z80._r.l&=255; Z80._ops.fz(Z80._r.l); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRCr_a: function() { var ci=Z80._r.a&1?0x80:0; var co=Z80._r.a&1?0x10:0; Z80._r.a=(Z80._r.a>>1)+ci; Z80._r.a&=255; Z80._ops.fz(Z80._r.a); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        RRCHL: function() { var i=MMU.rb((Z80._r.h<<8)+Z80._r.l); var ci=i&1?0x80:0; var co=i&1?0x10:0; i=(i>>1)+ci; i&=255; MMU.wb((Z80._r.h<<8)+Z80._r.l,i); Z80._ops.fz(i); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=4; Z80._r.t=16; },

        // Skiftoperasjoner (SLA, SLL, SRA, SRL) flytter bitene til venstre eller høyre der SLA beholder venstre bit og fyller høyre med null
        SLAr_b: function() { var co=Z80._r.b&0x80?0x10:0; Z80._r.b=(Z80._r.b<<1)&255; Z80._ops.fz(Z80._r.b); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLAr_c: function() { var co=Z80._r.c&0x80?0x10:0; Z80._r.c=(Z80._r.c<<1)&255; Z80._ops.fz(Z80._r.c); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLAr_d: function() { var co=Z80._r.d&0x80?0x10:0; Z80._r.d=(Z80._r.d<<1)&255; Z80._ops.fz(Z80._r.d); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLAr_e: function() { var co=Z80._r.e&0x80?0x10:0; Z80._r.e=(Z80._r.e<<1)&255; Z80._ops.fz(Z80._r.e); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLAr_h: function() { var co=Z80._r.h&0x80?0x10:0; Z80._r.h=(Z80._r.h<<1)&255; Z80._ops.fz(Z80._r.h); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLAr_l: function() { var co=Z80._r.l&0x80?0x10:0; Z80._r.l=(Z80._r.l<<1)&255; Z80._ops.fz(Z80._r.l); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLAr_a: function() { var co=Z80._r.a&0x80?0x10:0; Z80._r.a=(Z80._r.a<<1)&255; Z80._ops.fz(Z80._r.a); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },

        SLLr_b: function() { var co=Z80._r.b&0x80?0x10:0; Z80._r.b=(Z80._r.b<<1)&255+1; Z80._ops.fz(Z80._r.b); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLLr_c: function() { var co=Z80._r.c&0x80?0x10:0; Z80._r.c=(Z80._r.c<<1)&255+1; Z80._ops.fz(Z80._r.c); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLLr_d: function() { var co=Z80._r.d&0x80?0x10:0; Z80._r.d=(Z80._r.d<<1)&255+1; Z80._ops.fz(Z80._r.d); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLLr_e: function() { var co=Z80._r.e&0x80?0x10:0; Z80._r.e=(Z80._r.e<<1)&255+1; Z80._ops.fz(Z80._r.e); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLLr_h: function() { var co=Z80._r.h&0x80?0x10:0; Z80._r.h=(Z80._r.h<<1)&255+1; Z80._ops.fz(Z80._r.h); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLLr_l: function() { var co=Z80._r.l&0x80?0x10:0; Z80._r.l=(Z80._r.l<<1)&255+1; Z80._ops.fz(Z80._r.l); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SLLr_a: function() { var co=Z80._r.a&0x80?0x10:0; Z80._r.a=(Z80._r.a<<1)&255+1; Z80._ops.fz(Z80._r.a); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },

        // mens SRA beholder fortegn-biten (venstre bit), og SRL fyller både venstre og høyre med null
        SRAr_b: function() { var ci=Z80._r.b&0x80; var co=Z80._r.b&1?0x10:0; Z80._r.b=((Z80._r.b>>1)+ci)&255; Z80._ops.fz(Z80._r.b); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRAr_c: function() { var ci=Z80._r.c&0x80; var co=Z80._r.c&1?0x10:0; Z80._r.c=((Z80._r.c>>1)+ci)&255; Z80._ops.fz(Z80._r.c); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRAr_d: function() { var ci=Z80._r.d&0x80; var co=Z80._r.d&1?0x10:0; Z80._r.d=((Z80._r.d>>1)+ci)&255; Z80._ops.fz(Z80._r.d); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRAr_e: function() { var ci=Z80._r.e&0x80; var co=Z80._r.e&1?0x10:0; Z80._r.e=((Z80._r.e>>1)+ci)&255; Z80._ops.fz(Z80._r.e); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRAr_h: function() { var ci=Z80._r.h&0x80; var co=Z80._r.h&1?0x10:0; Z80._r.h=((Z80._r.h>>1)+ci)&255; Z80._ops.fz(Z80._r.h); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRAr_l: function() { var ci=Z80._r.l&0x80; var co=Z80._r.l&1?0x10:0; Z80._r.l=((Z80._r.l>>1)+ci)&255; Z80._ops.fz(Z80._r.l); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRAr_a: function() { var ci=Z80._r.a&0x80; var co=Z80._r.a&1?0x10:0; Z80._r.a=((Z80._r.a>>1)+ci)&255; Z80._ops.fz(Z80._r.a); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },

        SRLr_b: function() { var co=Z80._r.b&1?0x10:0; Z80._r.b=(Z80._r.b>>1)&255; Z80._ops.fz(Z80._r.b); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRLr_c: function() { var co=Z80._r.c&1?0x10:0; Z80._r.c=(Z80._r.c>>1)&255; Z80._ops.fz(Z80._r.c); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRLr_d: function() { var co=Z80._r.d&1?0x10:0; Z80._r.d=(Z80._r.d>>1)&255; Z80._ops.fz(Z80._r.d); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRLr_e: function() { var co=Z80._r.e&1?0x10:0; Z80._r.e=(Z80._r.e>>1)&255; Z80._ops.fz(Z80._r.e); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRLr_h: function() { var co=Z80._r.h&1?0x10:0; Z80._r.h=(Z80._r.h>>1)&255; Z80._ops.fz(Z80._r.h); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRLr_l: function() { var co=Z80._r.l&1?0x10:0; Z80._r.l=(Z80._r.l>>1)&255; Z80._ops.fz(Z80._r.l); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },
        SRLr_a: function() { var co=Z80._r.a&1?0x10:0; Z80._r.a=(Z80._r.a>>1)&255; Z80._ops.fz(Z80._r.a); Z80._r.f=(Z80._r.f&0xEF)+co; Z80._r.m=2; Z80._r.t=8; },

        // Komplementerer (invert) alle bitene i A-registeret , lagrer resultatet i A-registeret, og oppdaterer flaggene
        CPL: function() { Z80._r.a = (~Z80._r.a)&255; Z80._ops.fz(Z80._r.a,1); Z80._r.m=1; Z80._r.t=4; },
        // inverterer innholdet i A-registeret, oppdaterer flaggene, og lagrer resultatet i A-registeret
        NEG: function() { Z80._r.a=0-Z80._r.a; Z80._ops.fz(Z80._r.a,1); if(Z80._r.a<0) Z80._r.f|=0x10; Z80._r.a&=255; Z80._r.m=2; Z80._r.t=8; },
        // Komplementerer Carry-flagget, uten å endre innholdet i A-registeret
        CCF: function() { var ci=Z80._r.f&0x10?0:0x10; Z80._r.f=(Z80._r.f&0xEF)+ci; Z80._r.m=1; Z80._r.t=4; },
        // Setter Carry-flagget, uten å endre innholdet i A-registeret
        SCF: function() { Z80._r.f|=0x10; Z80._r.m=1; Z80._r.t=4; },

    //husk push legger på data
    // Push registre B og C til stacken (PUSH BC)
    PUSHBC: function () {
        Z80._r.sp--; //Tøm stack
        MMU.wb(Z80._r.sp, Z80._r.b); //skriv B
        Z80._r.sp--; //Tøm stack
        MMU.wb(Z80._r.sp, Z80._r.c); //skriv C
        Z80._r.m =3; Z80._r.t =12;
        // 3 grunnleggende m cycles,
        //Henting av instruksjonen (M1)
        //Skriv til minnet for å lagre B-registeret (M2)
        //Skriv til minnet for å lagre C-registeret (M3)
        // hver m har 4 t
    },

        PUSHDE: function() { Z80._r.sp--; MMU.wb(Z80._r.sp,Z80._r.d); Z80._r.sp--; MMU.wb(Z80._r.sp,Z80._r.e); Z80._r.m=3; Z80._r.t=12; },
        PUSHHL: function() { Z80._r.sp--; MMU.wb(Z80._r.sp,Z80._r.h); Z80._r.sp--; MMU.wb(Z80._r.sp,Z80._r.l); Z80._r.m=3; Z80._r.t=12; },
        PUSHAF: function() { Z80._r.sp--; MMU.wb(Z80._r.sp,Z80._r.a); Z80._r.sp--; MMU.wb(Z80._r.sp,Z80._r.f); Z80._r.m=3; Z80._r.t=12; },

    // husk pop = last in first out
    // Pop registre H og L fra stacken sp (POP HL)
    POPHL: function () {
        Z80._r.l = MMU.rb(Z80._r.sp); //Les sp og lagre i L
        Z80._r.sp++; //Gå oppover
        Z80._r.h = MMU.rb(Z80._r.sp); //Les sp igjen og lagre i H
        Z80._r.sp++; //Gå oppover
        Z80._r.m =3; Z80._r.t =12;
    },
        POPBC: function() { Z80._r.c=MMU.rb(Z80._r.sp); Z80._r.sp++; Z80._r.b=MMU.rb(Z80._r.sp); Z80._r.sp++; Z80._r.m=3; Z80._r.t=12; },
        POPDE: function() { Z80._r.e=MMU.rb(Z80._r.sp); Z80._r.sp++; Z80._r.d=MMU.rb(Z80._r.sp); Z80._r.sp++; Z80._r.m=3; Z80._r.t=12; },
        POPAF: function() { Z80._r.f=MMU.rb(Z80._r.sp); Z80._r.sp++; Z80._r.a=MMU.rb(Z80._r.sp); Z80._r.sp++; Z80._r.m=3; Z80._r.t=12; },

        //Utfører hoppoperasjoner ved å endre pc direkte
        JPnn: function() { Z80._r.pc = MMU.rw(Z80._r.pc); Z80._r.m=3; Z80._r.t=12; },
        JPHL: function() { Z80._r.pc=Z80._r.hl; Z80._r.m=1; Z80._r.t=4; },
        JPNZnn: function() { Z80._r.m=3; Z80._r.t=12; if((Z80._r.f&0x80)==0x00) { Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m++; Z80._r.t+=4; } else Z80._r.pc+=2; },
        JPZnn: function()  { Z80._r.m=3; Z80._r.t=12; if((Z80._r.f&0x80)==0x80) { Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m++; Z80._r.t+=4; } else Z80._r.pc+=2; },
        JPNCnn: function() { Z80._r.m=3; Z80._r.t=12; if((Z80._r.f&0x10)==0x00) { Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m++; Z80._r.t+=4; } else Z80._r.pc+=2; },
        JPCnn: function()  { Z80._r.m=3; Z80._r.t=12; if((Z80._r.f&0x10)==0x10) { Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m++; Z80._r.t+=4; } else Z80._r.pc+=2; },

        //Utfører relative hopp som justerer pc ved å legge til eller trekke fra en 8-bits offset
        JRn: function() { var i=MMU.rb(Z80._r.pc); if(i>127) i=-((~i+1)&255); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; Z80._r.pc+=i; Z80._r.m++; Z80._r.t+=4; },
        JRNZn: function() { var i=MMU.rb(Z80._r.pc); if(i>127) i=-((~i+1)&255); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; if((Z80._r.f&0x80)==0x00) { Z80._r.pc+=i; Z80._r.m++; Z80._r.t+=4; } },
        JRZn: function()  { var i=MMU.rb(Z80._r.pc); if(i>127) i=-((~i+1)&255); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; if((Z80._r.f&0x80)==0x80) { Z80._r.pc+=i; Z80._r.m++; Z80._r.t+=4; } },
        JRNCn: function() { var i=MMU.rb(Z80._r.pc); if(i>127) i=-((~i+1)&255); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; if((Z80._r.f&0x10)==0x00) { Z80._r.pc+=i; Z80._r.m++; Z80._r.t+=4; } },
        JRCn: function()  { var i=MMU.rb(Z80._r.pc); if(i>127) i=-((~i+1)&255); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; if((Z80._r.f&0x10)==0x10) { Z80._r.pc+=i; Z80._r.m++; Z80._r.t+=4; } },

        // DJNZn: Decrement B-registeret og hopp (relative jump) hvis B-registeret ikke er null
        DJNZn: function() { var i=MMU.rb(Z80._r.pc); if(i>127) i=-((~i+1)&255); Z80._r.pc++; Z80._r.m=2; Z80._r.t=8; Z80._r.b--; if(Z80._r.b) { Z80._r.pc+=i; Z80._r.m++; Z80._r.t+=4; } },

        // CALL-instruksjoner, Hopper til en ny adresse og lagrer returadressen på stacken
        CALLnn: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc+2); Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m=5; Z80._r.t=20; },
        CALLNZnn: function() { Z80._r.m=3; Z80._r.t=12; if((Z80._r.f&0x80)==0x00) { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc+2); Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m+=2; Z80._r.t+=8; } else Z80._r.pc+=2; },
        CALLZnn: function() { Z80._r.m=3; Z80._r.t=12; if((Z80._r.f&0x80)==0x80) { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc+2); Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m+=2; Z80._r.t+=8; } else Z80._r.pc+=2; },
        CALLNCnn: function() { Z80._r.m=3; Z80._r.t=12; if((Z80._r.f&0x10)==0x00) { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc+2); Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m+=2; Z80._r.t+=8; } else Z80._r.pc+=2; },
        CALLCnn: function() { Z80._r.m=3; Z80._r.t=12; if((Z80._r.f&0x10)==0x10) { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc+2); Z80._r.pc=MMU.rw(Z80._r.pc); Z80._r.m+=2; Z80._r.t+=8; } else Z80._r.pc+=2; },

        // RET-instruksjoner, Returnerer fra en subrutine ved å hente returadressen fra stacken
        RET: function() { Z80._r.pc=MMU.rw(Z80._r.sp); Z80._r.sp+=2; Z80._r.m=3; Z80._r.t=12; },
        RETI: function() { Z80._r.ime=1; Z80._r.pc=MMU.rw(Z80._r.sp); Z80._r.sp+=2; Z80._r.m=3; Z80._r.t=12; },
        RETNZ: function() { Z80._r.m=1; Z80._r.t=4; if((Z80._r.f&0x80)==0x00) { Z80._r.pc=MMU.rw(Z80._r.sp); Z80._r.sp+=2; Z80._r.m+=2; Z80._r.t+=8; } },
        RETZ: function() { Z80._r.m=1; Z80._r.t=4; if((Z80._r.f&0x80)==0x80) { Z80._r.pc=MMU.rw(Z80._r.sp); Z80._r.sp+=2; Z80._r.m+=2; Z80._r.t+=8; } },
        RETNC: function() { Z80._r.m=1; Z80._r.t=4; if((Z80._r.f&0x10)==0x00) { Z80._r.pc=MMU.rw(Z80._r.sp); Z80._r.sp+=2; Z80._r.m+=2; Z80._r.t+=8; } },
        RETC: function() { Z80._r.m=1; Z80._r.t=4; if((Z80._r.f&0x10)==0x10) { Z80._r.pc=MMU.rw(Z80._r.sp); Z80._r.sp+=2; Z80._r.m+=2; Z80._r.t+=8; } },

        // RST-instruksjoner, Utfører en reset ved å hoppe til en fast adresse og lagre returadressen på stacken
        // Disse instruksjonene brukes til å hoppe til faste adresser (0x00, 0x08, 0x10, osv.) og lagre den nåværende pc på stacken
        // Når RST utføres:
        //   1. Stack pointer reduseres med 2 for å gjøre plass til å lagre PC
        //   2. Den nåværende verdien av PC lagres på stacken
        //   3. PC settes til en fast adresse (som 0x00, 0x08, 0x10, osv.)
        // - Dette gjør at programmet kan hoppe til et bestemt sted og deretter returnere senere ved å hente adressen fra stacken

        RST00: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x00; Z80._r.m=3; Z80._r.t=12; },
        RST08: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x08; Z80._r.m=3; Z80._r.t=12; },
        RST10: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x10; Z80._r.m=3; Z80._r.t=12; },
        RST18: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x18; Z80._r.m=3; Z80._r.t=12; },
        RST20: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x20; Z80._r.m=3; Z80._r.t=12; },
        RST28: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x28; Z80._r.m=3; Z80._r.t=12; },
        RST30: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x30; Z80._r.m=3; Z80._r.t=12; },
        RST38: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x38; Z80._r.m=3; Z80._r.t=12; },
        RST40: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x40; Z80._r.m=3; Z80._r.t=12; },
        RST48: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x48; Z80._r.m=3; Z80._r.t=12; },
        RST50: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x50; Z80._r.m=3; Z80._r.t=12; },
        RST58: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x58; Z80._r.m=3; Z80._r.t=12; },
        RST60: function() { Z80._r.sp-=2; MMU.ww(Z80._r.sp,Z80._r.pc); Z80._r.pc=0x60; Z80._r.m=3; Z80._r.t=12; },

        // Utfører ingen operasjon og går videre til neste instruksjon
        NOP: function () {
            Z80._r.m=1; Z80._r.t=4;
        },

        // Stopper CPU-en inntil et avbrudd oppstår
        HALT: function() { Z80._halt=1; Z80._r.m=1; Z80._r.t=4; },

        // Deaktiverer avbrudd ved å nullstille interrupt master enable (IME)-flagget
        DI: function() { Z80._r.ime=0; Z80._r.m=1; Z80._r.t=4; },

        // Aktiverer avbrudd ved å sette interrupt master enable (IME)-flagget
        EI: function() { Z80._r.ime=1; Z80._r.m=1; Z80._r.t=4; },

        // Oppdaterer flaggregisteret (F) basert på resultatet av en operasjon
        // Setter Zero-flagget (bit 7) hvis resultatet er null
        // Setter eventuelt Subtraksjons-flagget (bit 6) hvis 'as' er sann
        fz: function(i,as) { Z80._r.f=0; if(!(i&255)) Z80._r.f|=128; Z80._r.f|=as?0x40:0; },

        // Håndterer CB-prefikset instruksjoner
        // Henter neste opcode og utfører tilsvarende funksjon fra _cbmap
        MAPcb: function() {
            var i=MMU.rb(Z80._r.pc); Z80._r.pc++;
            Z80._r.pc &= 65535;
            if(Z80._cbmap[i]) Z80._cbmap[i]();
            else alert(i);
        },

        // Håndterer udefinerte eller uimplementerte instruksjoner
        // Varsler brukeren og stopper CPU
        XX: function() {
            var opc = Z80._r.pc-1;
            alert('Unimplemented instruction at $'+opc.toString(16)+', stopping.');
            Z80._stop=1;
        }
    },

    _map: [],
    _cbmap: []
};

        //primær opcode tabell, hver instruksjon får en tilordnet funksjon
Z80._map = [
    // 00
    Z80._ops.NOP,
    Z80._ops.LDBCnn,
    Z80._ops.LDBCmA,
    Z80._ops.INCBC,
    Z80._ops.INCr_b,
    Z80._ops.DECr_b,
    Z80._ops.LDrn_b,
    Z80._ops.RLCA,
    Z80._ops.LDmmSP,
    Z80._ops.ADDHLBC,
    Z80._ops.LDABCm,
    Z80._ops.DECBC,
    Z80._ops.INCr_c,
    Z80._ops.DECr_c,
    Z80._ops.LDrn_c,
    Z80._ops.RRCA,

    // 10
    Z80._ops.DJNZn,
    Z80._ops.LDDEnn,
    Z80._ops.LDDEmA,
    Z80._ops.INCDE,
    Z80._ops.INCr_d,
    Z80._ops.DECr_d,
    Z80._ops.LDrn_d,
    Z80._ops.RLA,
    Z80._ops.JRn,
    Z80._ops.ADDHLDE,
    Z80._ops.LDADEm,
    Z80._ops.DECDE,
    Z80._ops.INCr_e,
    Z80._ops.DECr_e,
    Z80._ops.LDrn_e,
    Z80._ops.RRA,

    // 20
    Z80._ops.JRNZn,
    Z80._ops.LDHLnn,
    Z80._ops.LDHLIA,
    Z80._ops.INCHL,
    Z80._ops.INCr_h,
    Z80._ops.DECr_h,
    Z80._ops.LDrn_h,
    Z80._ops.XX,
    Z80._ops.JRZn,
    Z80._ops.ADDHLHL,
    Z80._ops.LDAHLI,
    Z80._ops.DECHL,
    Z80._ops.INCr_l,
    Z80._ops.DECr_l,
    Z80._ops.LDrn_l,
    Z80._ops.CPL,

    // 30
    Z80._ops.JRNCn,
    Z80._ops.LDSPnn,
    Z80._ops.LDHLDA,
    Z80._ops.INCSP,
    Z80._ops.INCHLm,
    Z80._ops.DECHLm,
    Z80._ops.LDHLmn,
    Z80._ops.SCF,
    Z80._ops.JRCn,
    Z80._ops.ADDHLSP,
    Z80._ops.LDAHLD,
    Z80._ops.DECSP,
    Z80._ops.INCr_a,
    Z80._ops.DECr_a,
    Z80._ops.LDrn_a,
    Z80._ops.CCF,

    // 40
    Z80._ops.LDrr_bb,
    Z80._ops.LDrr_bc,
    Z80._ops.LDrr_bd,
    Z80._ops.LDrr_be,
    Z80._ops.LDrr_bh,
    Z80._ops.LDrr_bl,
    Z80._ops.LDrHLm_b,
    Z80._ops.LDrr_ba,
    Z80._ops.LDrr_cb,
    Z80._ops.LDrr_cc,
    Z80._ops.LDrr_cd,
    Z80._ops.LDrr_ce,
    Z80._ops.LDrr_ch,
    Z80._ops.LDrr_cl,
    Z80._ops.LDrHLm_c,
    Z80._ops.LDrr_ca,

    // 50
    Z80._ops.LDrr_db,
    Z80._ops.LDrr_dc,
    Z80._ops.LDrr_dd,
    Z80._ops.LDrr_de,
    Z80._ops.LDrr_dh,
    Z80._ops.LDrr_dl,
    Z80._ops.LDrHLm_d,
    Z80._ops.LDrr_da,
    Z80._ops.LDrr_eb,
    Z80._ops.LDrr_ec,
    Z80._ops.LDrr_ed,
    Z80._ops.LDrr_ee,
    Z80._ops.LDrr_eh,
    Z80._ops.LDrr_el,
    Z80._ops.LDrHLm_e,
    Z80._ops.LDrr_ea,

    // 60
    Z80._ops.LDrr_hb,
    Z80._ops.LDrr_hc,
    Z80._ops.LDrr_hd,
    Z80._ops.LDrr_he,
    Z80._ops.LDrr_hh,
    Z80._ops.LDrr_hl,
    Z80._ops.LDrHLm_h,
    Z80._ops.LDrr_ha,
    Z80._ops.LDrr_lb,
    Z80._ops.LDrr_lc,
    Z80._ops.LDrr_ld,
    Z80._ops.LDrr_le,
    Z80._ops.LDrr_lh,
    Z80._ops.LDrr_ll,
    Z80._ops.LDrHLm_l,
    Z80._ops.LDrr_la,

    // 70
    Z80._ops.LDHLmr_b,
    Z80._ops.LDHLmr_c,
    Z80._ops.LDHLmr_d,
    Z80._ops.LDHLmr_e,
    Z80._ops.LDHLmr_h,
    Z80._ops.LDHLmr_l,
    Z80._ops.HALT,
    Z80._ops.LDHLmr_a,
    Z80._ops.LDrr_ab,
    Z80._ops.LDrr_ac,
    Z80._ops.LDrr_ad,
    Z80._ops.LDrr_ae,
    Z80._ops.LDrr_ah,
    Z80._ops.LDrr_al,
    Z80._ops.LDrHLm_a,
    Z80._ops.LDrr_aa,

    // 80
    Z80._ops.ADDr_b,
    Z80._ops.ADDr_c,
    Z80._ops.ADDr_d,
    Z80._ops.ADDr_e,
    Z80._ops.ADDr_h,
    Z80._ops.ADDr_l,
    Z80._ops.ADDHL,
    Z80._ops.ADDr_a,
    Z80._ops.ADCr_b,
    Z80._ops.ADCr_c,
    Z80._ops.ADCr_d,
    Z80._ops.ADCr_e,
    Z80._ops.ADCr_h,
    Z80._ops.ADCr_l,
    Z80._ops.ADCHL,
    Z80._ops.ADCr_a,

    // 90
    Z80._ops.SUBr_b,
    Z80._ops.SUBr_c,
    Z80._ops.SUBr_d,
    Z80._ops.SUBr_e,
    Z80._ops.SUBr_h,
    Z80._ops.SUBr_l,
    Z80._ops.SUBHL,
    Z80._ops.SUBr_a,
    Z80._ops.SBCr_b,
    Z80._ops.SBCr_c,
    Z80._ops.SBCr_d,
    Z80._ops.SBCr_e,
    Z80._ops.SBCr_h,
    Z80._ops.SBCr_l,
    Z80._ops.SBCHL,
    Z80._ops.SBCr_a,

    // A0
    Z80._ops.ANDr_b,
    Z80._ops.ANDr_c,
    Z80._ops.ANDr_d,
    Z80._ops.ANDr_e,
    Z80._ops.ANDr_h,
    Z80._ops.ANDr_l,
    Z80._ops.ANDHL,
    Z80._ops.ANDr_a,
    Z80._ops.XORr_b,
    Z80._ops.XORr_c,
    Z80._ops.XORr_d,
    Z80._ops.XORr_e,
    Z80._ops.XORr_h,
    Z80._ops.XORr_l,
    Z80._ops.XORHL,
    Z80._ops.XORr_a,

    // B0
    Z80._ops.ORr_b,
    Z80._ops.ORr_c,
    Z80._ops.ORr_d,
    Z80._ops.ORr_e,
    Z80._ops.ORr_h,
    Z80._ops.ORr_l,
    Z80._ops.ORHL,
    Z80._ops.ORr_a,
    Z80._ops.CPr_b,
    Z80._ops.CPr_c,
    Z80._ops.CPr_d,
    Z80._ops.CPr_e,
    Z80._ops.CPr_h,
    Z80._ops.CPr_l,
    Z80._ops.CPHL,
    Z80._ops.CPr_a,

    // C0
    Z80._ops.RETNZ,
    Z80._ops.POPBC,
    Z80._ops.JPNZnn,
    Z80._ops.JPnn,
    Z80._ops.CALLNZnn,
    Z80._ops.PUSHBC,
    Z80._ops.ADDn,
    Z80._ops.RST00,
    Z80._ops.RETZ,
    Z80._ops.RET,
    Z80._ops.JPZnn,
    Z80._ops.MAPcb,
    Z80._ops.CALLZnn,
    Z80._ops.CALLnn,
    Z80._ops.ADCn,
    Z80._ops.RST08,

    // D0
    Z80._ops.RETNC,
    Z80._ops.POPDE,
    Z80._ops.JPNCnn,
    Z80._ops.XX,
    Z80._ops.CALLNCnn,
    Z80._ops.PUSHDE,
    Z80._ops.SUBn,
    Z80._ops.RST10,
    Z80._ops.RETC,
    Z80._ops.RETI,
    Z80._ops.JPCnn,
    Z80._ops.XX,
    Z80._ops.CALLCnn,
    Z80._ops.XX,
    Z80._ops.SBCn,
    Z80._ops.RST18,

    // E0
    Z80._ops.LDIOnA,
    Z80._ops.POPHL,
    Z80._ops.LDIOCA,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.PUSHHL,
    Z80._ops.ANDn,
    Z80._ops.RST20,
    Z80._ops.ADDSPn,
    Z80._ops.JPHL,
    Z80._ops.LDmmA,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.ORn,
    Z80._ops.RST28,

    // F0
    Z80._ops.LDAIOn,
    Z80._ops.POPAF,
    Z80._ops.LDAIOC,
    Z80._ops.DI,
    Z80._ops.XX,
    Z80._ops.PUSHAF,
    Z80._ops.XORn,
    Z80._ops.RST30,
    Z80._ops.LDHLSPn,
    Z80._ops.XX,
    Z80._ops.LDAmm,
    Z80._ops.EI,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.CPn,
    Z80._ops.RST38
];
    //Dekker CB instruksjoner
Z80._cbmap = [
    // CB00
    Z80._ops.RLCr_b,
    Z80._ops.RLCr_c,
    Z80._ops.RLCr_d,
    Z80._ops.RLCr_e,
    Z80._ops.RLCr_h,
    Z80._ops.RLCr_l,
    Z80._ops.RLCHL,
    Z80._ops.RLCr_a,
    Z80._ops.RRCr_b,
    Z80._ops.RRCr_c,
    Z80._ops.RRCr_d,
    Z80._ops.RRCr_e,
    Z80._ops.RRCr_h,
    Z80._ops.RRCr_l,
    Z80._ops.RRCHL,
    Z80._ops.RRCr_a,

    // CB10
    Z80._ops.RLr_b,
    Z80._ops.RLr_c,
    Z80._ops.RLr_d,
    Z80._ops.RLr_e,
    Z80._ops.RLr_h,
    Z80._ops.RLr_l,
    Z80._ops.RLHL,
    Z80._ops.RLr_a,
    Z80._ops.RRr_b,
    Z80._ops.RRr_c,
    Z80._ops.RRr_d,
    Z80._ops.RRr_e,
    Z80._ops.RRr_h,
    Z80._ops.RRr_l,
    Z80._ops.RRHL,
    Z80._ops.RRr_a,

    // CB20
    Z80._ops.SLAr_b,
    Z80._ops.SLAr_c,
    Z80._ops.SLAr_d,
    Z80._ops.SLAr_e,
    Z80._ops.SLAr_h,
    Z80._ops.SLAr_l,
    Z80._ops.XX,
    Z80._ops.SLAr_a,
    Z80._ops.SRAr_b,
    Z80._ops.SRAr_c,
    Z80._ops.SRAr_d,
    Z80._ops.SRAr_e,
    Z80._ops.SRAr_h,
    Z80._ops.SRAr_l,
    Z80._ops.XX,
    Z80._ops.SRAr_a,

    // CB30
    Z80._ops.SWAPr_b,
    Z80._ops.SWAPr_c,
    Z80._ops.SWAPr_d,
    Z80._ops.SWAPr_e,
    Z80._ops.SWAPr_h,
    Z80._ops.SWAPr_l,
    Z80._ops.XX,
    Z80._ops.SWAPr_a,
    Z80._ops.SRLr_b,
    Z80._ops.SRLr_c,
    Z80._ops.SRLr_d,
    Z80._ops.SRLr_e,
    Z80._ops.SRLr_h,
    Z80._ops.SRLr_l,
    Z80._ops.XX,
    Z80._ops.SRLr_a,

    // CB40
    Z80._ops.BIT0b,
    Z80._ops.BIT0c,
    Z80._ops.BIT0d,
    Z80._ops.BIT0e,
    Z80._ops.BIT0h,
    Z80._ops.BIT0l,
    Z80._ops.BIT0m,
    Z80._ops.BIT0a,
    Z80._ops.BIT1b,
    Z80._ops.BIT1c,
    Z80._ops.BIT1d,
    Z80._ops.BIT1e,
    Z80._ops.BIT1h,
    Z80._ops.BIT1l,
    Z80._ops.BIT1m,
    Z80._ops.BIT1a,

    // CB50
    Z80._ops.BIT2b,
    Z80._ops.BIT2c,
    Z80._ops.BIT2d,
    Z80._ops.BIT2e,
    Z80._ops.BIT2h,
    Z80._ops.BIT2l,
    Z80._ops.BIT2m,
    Z80._ops.BIT2a,
    Z80._ops.BIT3b,
    Z80._ops.BIT3c,
    Z80._ops.BIT3d,
    Z80._ops.BIT3e,
    Z80._ops.BIT3h,
    Z80._ops.BIT3l,
    Z80._ops.BIT3m,
    Z80._ops.BIT3a,

    // CB60
    Z80._ops.BIT4b,
    Z80._ops.BIT4c,
    Z80._ops.BIT4d,
    Z80._ops.BIT4e,
    Z80._ops.BIT4h,
    Z80._ops.BIT4l,
    Z80._ops.BIT4m,
    Z80._ops.BIT4a,
    Z80._ops.BIT5b,
    Z80._ops.BIT5c,
    Z80._ops.BIT5d,
    Z80._ops.BIT5e,
    Z80._ops.BIT5h,
    Z80._ops.BIT5l,
    Z80._ops.BIT5m,
    Z80._ops.BIT5a,

    // CB70
    Z80._ops.BIT6b,
    Z80._ops.BIT6c,
    Z80._ops.BIT6d,
    Z80._ops.BIT6e,
    Z80._ops.BIT6h,
    Z80._ops.BIT6l,
    Z80._ops.BIT6m,
    Z80._ops.BIT6a,
    Z80._ops.BIT7b,
    Z80._ops.BIT7c,
    Z80._ops.BIT7d,
    Z80._ops.BIT7e,
    Z80._ops.BIT7h,
    Z80._ops.BIT7l,
    Z80._ops.BIT7m,
    Z80._ops.BIT7a,

    // CB80
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,

    // CB90
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,

    // CBA0
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,

    // CBB0
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,

    // CBC0
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,

    // CBD0
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,

    // CBE0
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,

    // CBF0
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX,
    Z80._ops.XX
];
