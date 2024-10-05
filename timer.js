TIMER = {
    _clock: {
        main: 0,
        sub:  0,
        div:  0
    },

    _reg: {
        div:  0,
        tima: 0,
        tma:  0,
        tac:  0
    },

    inc: function()
    {
        // Øk med tiden fra den siste opcode
        TIMER._clock.sub += Z80._r.m;

        // Ingen opcode tar lengre tid enn 4 M-tider,
        // så vi trenger bare sjekke for overflow én gang
        if(TIMER._clock.sub >= 4)
        {
            TIMER._clock.main++;
            TIMER._clock.sub -= 4;

            // DIV-registeret øker med 1/16
            // av hastigheten, så vi holder oversikt over dette
            TIMER._clock.div++;
            if(TIMER._clock.div == 16)
            {
                TIMER._reg.div = (TIMER._reg.div + 1) & 255;
                TIMER._clock.div = 0;
            }
        }

        // Sjekk om en stegning er nødvendig for timeren
        TIMER.check();
    },

    check: function()
    {
        if(TIMER._reg.tac & 4)
        {
            switch(TIMER._reg.tac & 3)
            {
                case 0: threshold = 64; break;		// 4K
                case 1: threshold =  1; break;		// 256K
                case 2: threshold =  4; break;		// 64K
                case 3: threshold = 16; break;		// 16K
            }

            if(TIMER._clock.main >= threshold) TIMER.step();
        }
    },

    step: function()
    {
        // Øk timeren med én
        TIMER._clock.main = 0;
        TIMER._reg.tima++;

        if(TIMER._reg.tima > 255)
        {
            // Ved overflow, fyll opp med Modulo-verdien
            TIMER._reg.tima = TIMER._reg.tma;

            // Flag en timer-avbrudd til dispatcheren
            MMU._if |= 4;
        }
    },

    rb: function(addr)
    {
        switch(addr)
        {
            // DIV-register
            case 0xFF04: return TIMER._reg.div;
            // TIMA-register
            case 0xFF05: return TIMER._reg.tima;
            // TMA-register
            case 0xFF06: return TIMER._reg.tma;
            // TAC-register
            case 0xFF07: return TIMER._reg.tac;
        }
    },

    wb: function(addr, val)
    {
        switch(addr)
        {
            // Tilbakestill DIV-registeret
            case 0xFF04: TIMER._reg.div = 0; break;
            // Sett TIMA-registeret
            case 0xFF05: TIMER._reg.tima = val; break;
            // Sett TMA-registeret
            case 0xFF06: TIMER._reg.tma = val; break;
            // Sett TAC-registeret
            case 0xFF07: TIMER._reg.tac = val & 7; break;
        }
    },
};
