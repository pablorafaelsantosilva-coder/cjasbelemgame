## Encerrar inscrições do Baile e liberar a votação

O site já tem o botão "Encerrar inscrições do Baile e liberar a votação", mas o banco ainda não sabe dessa opção, então ela não funciona.

### O que vou fazer
1. Ativar no banco a opção de inscrições encerradas (começa desligada, nada se perde).
2. Quando encerrada: ninguém mais consegue se inscrever, nem fora da tela.
3. Votação só é aceita depois do encerramento; continua 1 voto por pessoa, pode trocar, não vota em si mesmo.
4. Encerrar agora as inscrições, liberando a votação hoje. Inscrições e fotos já feitas ficam intactas.
5. Testar: tentar inscrever (deve recusar) e votar com conta logada (deve aceitar).

### Detalhes técnicos
- Aplicar o arquivo existente 0010_costume_voting_phase (coluna `event_settings.costume_registration_closed` + triggers atualizados) byte a byte.
- Depois, via consulta de dados, `UPDATE event_settings SET costume_registration_closed = true WHERE id = 1`.
- Conferir a coluna no banco e que admin.configuracoes salva o interruptor.
