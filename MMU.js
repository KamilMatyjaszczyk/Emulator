// Memory Interface
MMU = {
    //inbios fungerer som et flagg, da 1 betyr bios er aktivt
    _inbios: 1,
    //resten av minneplasseringene
    _bios: [],
    _rom: '',
    _wram: [],
    _eram: [],
    _zram: [],


    reset: function() {
        GPU._tileset = [];

        for(i=0; i<8192; i++) {
            MMU._wram[i] = 0;
            MMU._eram[i] = 0;
        }
        for(i=0; i<127; i++) {
            MMU._zram[i] = 0;
        }
        MMU._inbios=1;
        MMU._ie=0;
        MMU._if=0;
    },
    /* Leser 8-bit byte fra gitt adresse */
    rb: function(addr) {
        switch (addr & 0xF000) {
            //starter med BIOS
            case 0x0000:
                if(MMU._inbios){
                if(addr < 0x0100)
                    return MMU._bios[addr];
                else if(Z80._r.pc == 0x0100) {
                    MMU._inbios = 0;
                }
            } else {
                    return MMU._rom.charCodeAt(addr);
                }

            // ROM0
            case 0x1000: case 0x2000: case 0x3000:
            return MMU._rom.charCodeAt(addr);

            // ROM1
            case 0x4000: case 0x5000: case 0x6000: case 0x7000:
            return MMU._rom.charCodeAt(addr);

            // Grafikk, VRAM (8)
            case 0x8000: case 0x9000:
            return GPU._vram[addr];

            //Ekstern RAM (8)
            case 0xA000: case 0xB000:
            return MMU._eram[addr & 0x1FFF];

            //ArbeidsRAM (8)
            case 0xC000: case 0xD000:
            return MMU._wram[addr & 0x1FFF];

            //WRAM shadow, gjør det mulig å hente data fra to adresser
            case 0xE000:
            return MMU._wram[addr & 0x1FFF];

            //RAM shadow, samt I/O og zero page RAM
            case 0xF000:
                switch(addr & 0xF00) {

                    //arbeidsRAM
                    case 0x000: case 0x100: case 0x200: case 0x300:
                    case 0x400: case 0x500: case 0x600: case 0x700:
                    case 0x800: case 0x900: case 0xA00: case 0xB00:
                    case 0xC00: case 0xD00:
                        return MMU._wram[addr & 0x1FFF];

                    // Grafisk RAM atributter, hvor OAM er 160 bytes
                    case 0xE00:
                        if(addr < 0xFEA0)
                            return GPU._oam[addr & 0xFF];
                        else
                            return 0;
                    //Zero Page
                    case 0xF00:
                        if(addr >= 0xFF80)
                        {
                            return MMU._zram[addr & 0x7F];
                        }
                        else
                        {
                            // I/O kontrollbehandling, atm ingen.
                            return 0;
                        }
                }
        }
    },

    /* Leser 16-bit ord fra gitt adresse */
    rw: function(addr) {
        return MMU.rb(addr) + (MMU.rb(addr+1) << 8);
    },

    /* skriv 8-bit byte til en gitt adresse */
    wb: function(addr, val) {  },

    /* skriv 16-bit ord til en gitt adresse */
    ww: function(addr, val) {  },

    load: function(file)
    {
        var b = new BinFileReader(file);
        MMU._rom = b.readString(b.getFileSize(), 0);
    },
};