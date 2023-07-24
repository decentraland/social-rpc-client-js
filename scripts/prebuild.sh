mkdir -p src/protobuff-types
protoc \
  --plugin=./node_modules/.bin/protoc-gen-dcl_ts_proto \
  --dcl_ts_proto_opt=esModuleInterop=true,returnObservable=false,outputServices=generic-definitions,fileSuffix=.gen \
  --dcl_ts_proto_out="$(pwd)/src/protobuff-types" \
  -I="$(pwd)/node_modules/@dcl/protocol/public" \
  -I="$(pwd)/node_modules/@dcl/protocol/proto" \
  "$(pwd)/node_modules/@dcl/protocol/public/social.proto"
