# Conferência de fontes e dados das unidades

Referências para validação antes da versão pública. Estes links são fontes municipais para consulta; não tornam o app oficial nem sustentam estimativas de espera em tempo real.

- [Plano Municipal de Saúde de Guarujá, 2026–2029](https://www.guaruja.sp.gov.br/plataforma/wp-content/uploads/2025/10/PMS-2026-2029-Completo-Final-rev01.pdf) — contexto da rede de urgência e mudança de endereço da UPA Enseada.
- [Prefeitura: lista das cinco unidades em notícia sobre atendimento](https://www.guaruja.sp.gov.br/guaruja-abre-tres-unidades-de-saude-para-plantao-especial-a-partir-deste-sabado) — referência para nomes e endereços, de dezembro de 2024; não reaproveitar horários temporários.
- [Diário Oficial de Guarujá, fevereiro de 2025](https://www.guaruja.sp.gov.br/plataforma/wp-content/uploads/2025/02/27-0gH9V6SB72-2025.pdf) — fonte adicional para cruzar endereços. O arquivo oficial é uma referência dos dados, não a política de privacidade do app.

## Antes de publicar

1. Comparar nome, endereço, telefone, coordenadas e horário retornados pela API com fonte oficial atual e confirmação da unidade quando houver divergência. Conferir também os valores de fallback usados no site e no app.
2. **Rodoviária:** notícia municipal lista Avenida Santos Dumont, 995; fallback do site informa 856. **Vicente de Carvalho:** notícia lista São João, 155; Diário Oficial de fevereiro de 2025 e fallback indicam 111. Não assumir que o número de uma fonte histórica é o correto hoje. Confirmar entrada da unidade e rota real antes de liberar.
3. Guardar a fonte, data de conferência e resultado por unidade. Corrigir na origem e repetir o teste da rota no aparelho.
4. Indicar claramente dados de exemplo, sem confundir o diretório de unidades com disponibilidade ou fila oficial. Enquanto a integração não estiver validada, não usar “ao vivo” na ficha nem em imagens da loja.
5. Incluir links verificáveis e aviso de projeto independente na descrição da loja e no app. Conferir autorização de uso para fotos e marcas exibidas.
