; PHP Symbol Extraction Queries

(class_declaration
  name: (name) @symbol.name) @symbol.kind_class

(interface_declaration
  name: (name) @symbol.name) @symbol.kind_interface

(trait_declaration
  name: (name) @symbol.name) @symbol.kind_trait

(enum_declaration
  name: (name) @symbol.name) @symbol.kind_enum

(function_definition
  name: (name) @symbol.name) @symbol.kind_function

(method_declaration
  name: (name) @symbol.name) @symbol.kind_method

(namespace_definition
  (namespace_name) @symbol.name) @symbol.kind_namespace

(property_declaration
  (property_element
    (variable_name) @symbol.name)) @symbol.kind_property

(const_declaration
  (const_element
    (name) @symbol.name)) @symbol.kind_constant

(enum_case
  (name) @symbol.name) @symbol.kind_constant
