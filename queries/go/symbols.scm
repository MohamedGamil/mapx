(type_spec
  name: (type_identifier) @symbol.name
  type: (struct_type)) @symbol.kind_struct

(type_spec
  name: (type_identifier) @symbol.name
  type: (interface_type)) @symbol.kind_interface

(function_declaration
  name: (identifier) @symbol.name) @symbol.kind_function

(method_declaration
  receiver: (parameter_list
    (parameter_declaration
      type: [
        (pointer_type (type_identifier) @symbol.scope)
        (type_identifier) @symbol.scope
      ]
    )
  )
  name: (field_identifier) @symbol.name
) @symbol.kind_method
