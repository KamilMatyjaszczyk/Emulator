MMU = {
    rb: function(addr) { /* Les 8-bit byte fra en gitt adresse */ },
    rw: function(addr) { /* Les 16-bit ord fra en gitt adresse */ },
    wb: function(addr, val) {/* Skriv 8-bit byte til en gitt adresse */},
    ww: function(addr, val) {/* Skriv en 16-bit ord til en gitt adresse */}
};