FROM ghcr.io/cosmos/gaia:v22.0.0

ENV CHAIN_ID=cosmoshub-4
ENV TEST_ADDRESS=cosmos15wgtkntdf26hqan77g0kdsldcxjddypxughytg

RUN gaiad init test-node --chain-id $CHAIN_ID \
  && sed -i 's/"stake"/"uatom"/g' ~/.gaia/config/genesis.json \
  && jq '.app_state.feemarket.params.min_base_gas_price = "0.005000000000000000" | .app_state.feemarket.state.base_gas_price = "0.005000000000000000"' ~/.gaia/config/genesis.json > /tmp/genesis.json \
  && mv /tmp/genesis.json ~/.gaia/config/genesis.json \
  && gaiad keys add validator --keyring-backend=test \
  && gaiad genesis add-genesis-account $(gaiad keys show validator -a --keyring-backend=test) 100000000000uatom \
  && gaiad genesis add-genesis-account $TEST_ADDRESS 100000000000uatom \
  && gaiad genesis gentx validator 100000000uatom --keyring-backend=test --chain-id $CHAIN_ID \
  && gaiad genesis collect-gentxs \
  && sed -i 's/timeout_propose = "3s"/timeout_propose = "1s"/g' ~/.gaia/config/config.toml \
  && sed -i 's/minimum-gas-prices = ""/minimum-gas-prices = "0uatom"/g' ~/.gaia/config/app.toml \
  && sed -i 's/127.0.0.1:26657/0.0.0.0:26657/g' ~/.gaia/config/config.toml

EXPOSE 26657 1317

ENTRYPOINT []
CMD ["gaiad", "start", "--api.enable=true", "--api.address=tcp://0.0.0.0:1317"]
