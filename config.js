// Endereço e chave pública do Supabase, onde ficam guardadas as escolhas.
// A chave pública pode ficar no GitHub: o banco só deixa ver e registrar escolhas, nunca apagar.
window.CONFIG = {
  supabaseUrl: "https://afdqtofvgadakdnvpdbu.supabase.co",
  supabaseChavePublica: "sb_publishable_ZoHEAAZRs29_dPGYGDA6kQ_zPl43iaA",
  // Modo mestre: abra o site com ?mestre=SENHA no final do endereço.
  // Aqui fica só o SHA-256 da senha (não a senha em si).
  senhaMestreSha256: "f758a642955393534fa5c0e70cd039d853dcaf1053c7014c509ff505eaea1d11",
};
