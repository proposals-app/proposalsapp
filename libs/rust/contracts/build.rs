use ethers::contract::MultiAbigen;

fn main() {
    let gen = MultiAbigen::from_json_files("./src/abi/json").unwrap();
    let bindings = gen.build().unwrap();
    bindings.write_to_module("./src/gen", false).unwrap();
}
