const PREC = {
  omit_parens: -1,

  parenthesized_expression: 1,
  subscript: 2,
  private_id: 3,

  // https://nim-lang.org/docs/manual.html#syntax-precedence
  op0: 10,
  op1: 11,
  op2: 12,
  op3: 13,
  op4: 14,
  op5: 15,
  op6: 16,
  op7: 17,
  op8: 18,
  op9: 19,
  op10: 20,

  of_clause: 21,
  call: 21,
}

module.exports = grammar({
  name: 'nim',

  extras: $ => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\\\r?\n/
  ],

  externals: $ => [
    $._newline,
    $._indent,
    $._dedent,
    $._string_start,
    $._string_content,
    $._string_end,
  ],

  inline: $ => [
    $._simple_statement,
    $._compound_statement,
    $._suite,
    $._parameter,
  ],

  word: $ => $.identifier,

  rules: {
    module: $ => repeat(alias($._statement, $.block)),

    _statement: $ => choice(
      $._simple_statements,
      $._compound_statement
    ),

    // Simple statements

    _simple_statements: $ => seq(
      $._simple_statement,
      optional(repeat(seq(
        $._semicolon,
        $._simple_statement
      ))),
      optional($._semicolon),
      $._newline
    ),

    _simple_statement: $ => choice(
      $.import_statement,
      $.import_from_statement,
      $.omit_parens_statement,
      $._expression_statement,
    ),

    import_statement: $ => seq(
      'import',
      $._module_list,
    ),

    import_from_statement: $ => seq(
      'from',
      $._module_list,
      'import',
      $._import_list,
    ),

    _module_list: $ => seq(
      sep1(field('name', choice($._slashed_name, $.string)), $._comma),
      optional($._aliased_import),
    ),

    _import_list: $ => seq(
      sep1(field('name', $._id_or_str), $._comma),
    ),

    _aliased_import: $ => seq(
      'as',
      field('alias', $._id_or_str)
    ),

    omit_parens_statement: $ =>
      prec(PREC.omit_parens, seq(
        $.identifier,
        sep1(field('argument', $._expression), $._comma),
        optional($._comma))
      ),

    _expression_statement: $ => choice(
      $._expression,
      seq(sep1($._expression, $._comma), optional($._comma)),
      $.assignment,
      $.declaration,
      $.pragma,
    ),

    // Type definitions
    
    generics: $ => seq(
      '[',
      sep1($._id_or_str, $._comma_or_semi),
      optional($._comma_or_semi),
      ']'
    ),

    _type: $ => seq(
      choice($.public_id, $._id_or_str),
      optional($.generics),
      optional($.pragma),
      $._equals,
      $._type_name,
      optional($._suite),
    ),

    _type_line: $ => seq(
      alias($._type, $.block),
      $._newline
    ),

    _type_block: $ => seq(
      repeat($._type_line),
      $._dedent
    ),

    _type_body: $ => choice(
      $._type_line,
      seq($._indent, $._type_block)
    ),

    type_definition: $ => seq(
      'type',
      alias($._type_body, $.block)
    ),

    // Case expressions

    _of_clause: $ => prec(PREC.of_clause, seq(
      alias('of', $.op),
      sep1($._expression, $._comma),
      $._colon,
      $._suite,
    )),

    _case_line: $ => seq(
      $._expression,
      $._newline
    ),

    _case_block: $ => seq(
      repeat($._case_line),
      $._dedent
    ),

    _case_body: $ => choice(
      $._case_line,
      seq($._indent, $._case_block)
    ),

    _case_expression: $ => prec.right(seq(
      'case',
      $.identifier,
      $._colon,
      optional($._type_name),
      alias(field('body', $._case_body), $.block)
    )),

    // Compount statements

    _compound_statement: $ => choice(
      $.function_definition,
      alias($.generic_statement, $.block),
      $.type_definition,
      $._object_pair,
    ),

    generic_statement: $ => seq(
      $.identifier,
      repeat($._expression),
      $._colon,
      field('body', $._suite)
    ),

    _object_pair: $ => seq(
      choice($.public_id, $._id_or_str),
      $._colon,
      $._type_name,
    ),

    pragma: $ => seq(
      '{.',
      optional(sep1(choice($._expression, $.pair), $._comma)),
      optional($._comma),
      '.}'
    ),

    function_definition: $ => prec.right(seq(
      choice('proc', 'func', 'template', 'macro', 'iterator', 'method'),
      field('name', choice($.public_id, $._id_or_str)),
      optional($.generics),
      optional(field('parameters', $.parameters)),
      optional(
        seq(
          $._colon,
          field('return_type', $._type_name)
        )
      ),
      optional($.pragma),
      optional(seq(
        $._equals,
        optional(field('body', $._suite))
      )),
    )),

    lambda_definition: $ => prec.right(seq(
      choice('proc', 'func'),
      optional(field('parameters', $.parameters)),
      optional(
        seq(
          $._colon,
          field('return_type', $._type_name)
        )
      ),
      optional($.pragma),
      optional(seq(
        $._equals,
        optional(field('body', $._suite))
      )),
    )),

    parameters: $ => seq(
      '(',
      optional($._parameters),
      ')'
    ),

    _parameters: $ => seq(
      sep1($._parameter, $._comma_or_semi),
      optional($._comma_or_semi)
    ),

    _parameter: $ => choice(
      $.identifier,
      $.tuple,
      $.typed_parameter,
      $.default_parameter,
      $.typed_default_parameter
    ),

    default_parameter: $ => seq(
      field('name', choice($.identifier, $.string)),
      $._equals,
      field('value', $._expression)
    ),

    typed_default_parameter: $ => seq(
      field('name', choice($.identifier, $.string)),
      $._colon,
      field('type', $._type_name),
      $._equals,
      field('value', $._expression)
    ),

    argument_list: $ => seq(
      '(',
      optional(sep1(
        choice(
          $._expression,
          $.keyword_argument
        ),
        $._comma
      )),
      optional($._comma),
      ')'
    ),

    _suite: $ => choice(
      alias($._simple_statements, $.block),
      seq($._indent, $.block)
    ),

    block: $ => seq(
      repeat($._statement),
      $._dedent
    ),

    variables: $ => seq(
      sep1(choice($.identifier, $.tuple), $._comma),
      optional($._comma)
    ),

    expression_list: $ => prec.right(seq(
      sep1($._expression, $._comma),
      optional($._comma)
    )),

    identifier_list: $ => seq(
      '[',
      optional(sep1($.identifier, $._comma)),
      optional($._comma),
      ']'
    ),

    _slashed_name: $ => seq(
      sep1($.identifier, $._slash),
      optional(
        seq(
          $._slash,
          $.identifier_list
        )
      )
    ),

    // Expressions

    _expression: $ => choice(
      $.operator,
      $.identifier,
      $.string,
      $.integer,
      $.float,
      $.true,
      $.false,
      $.none,
      $.attribute,
      $.subscript,
      $.call,
      $.list,
      $.dictionary,
      $.set,
      $.tuple,
      $.parenthesized_expression,
      $.lambda_definition,
      alias($._case_expression, $.block),
      alias($._of_clause, $.block),
    ),

    operator: $ => {
      // https://nim-lang.org/docs/manual.html#lexical-analysis-operators
      const table = [
        // arrow
        [prec.left, /[=+\-*/<>@$~&%|!?\^.:\\]*->/, PREC.op0],
        [prec.left, /[=+\-*/<>@$~&%|!?\^.:\\]*=>/, PREC.op0],
        [prec.left, /[=+\-*/<>@$~&%|!?\^.:\\]*~>/, PREC.op0],
        // assignment
        // If the operator ends with = and its first character is none of <, >, !, =, ~, ?
        [prec.left, /[+\-*/@$&%|\^.:\\]+[=+\-*/<>@$~&%|!?\^.:\\]*=/, PREC.op1],
        // (first char @ : ?)
        [prec.left, /[@:?][=+\-*/<>@$~&%|!?\^.:\\]+/, PREC.op2],
        [prec.left, '@', PREC.op2],
        [prec.left, '?', PREC.op2],
        // or xor
        [prec.left, 'or', PREC.op3],
        [prec.left, 'xor', PREC.op3],
        // and
        [prec.left, 'and', PREC.op4],
        // in notin is isnot not of (first char = < > !)
        [prec.left, 'in', PREC.op5],
        [prec.left, 'notin', PREC.op5],
        [prec.left, 'is', PREC.op5],
        [prec.left, 'isnot', PREC.op5],
        [prec.left, 'not', PREC.op5],
        [prec.left, 'of', PREC.op5],
        [prec.left, /[=<>!][=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op5],
        // (first char .)
        [prec.left, /\.[=+\-*/<>@$~&%|!?\^.:\\]+/, PREC.op6],
        // (first char &)
        [prec.left, /&[=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op7],
        // (first char + - ~ |)
        [prec.left, /[+\-~|][=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op8],
        // (first char * % \ /)
        [prec.left, /[%\\\/][=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op9],
        [prec.left, '*', PREC.op9],
        [prec.left, /\*[=+\-*/<>@$~&%|!?\^.:\\]*[=+\-*/<>@$~&%|!?\^.\\]/, PREC.op9], // starts with * and ends with anything but :
        [prec.left, 'div', PREC.op9],
        [prec.left, 'mod', PREC.op9],
        [prec.left, 'shl', PREC.op9],
        [prec.left, 'shr', PREC.op9],
        // (first char $ ^)
        [prec.left, /\$[=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op10],
        [prec.right, /\^[=+\-*/<>@$~&%|!?\^.:\\]*/, PREC.op10],
      ];

      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        // The not keyword is always a unary operator, a not b is parsed as a(not b), not as (a) not (b)
        operator == 'not' ? blank() : optional(field('left', $._expression)),
        alias(operator, $.op),
        field('right', $._expression)
      ))));
    },

    // Assignments and Declarations

    assignment: $ => seq(
      field('left', $._expression),
      optional($._star),
      $._equals,
      field('right', $._suite),
    ),

    decl: $ => seq(
      field('left', $._expression),
      optional($._star),
      $._colon,
      choice(
        field('type', $._type_name),
        seq(field('type', $._type_name), $._equals, field('right', $._suite))
      )
    ),

    _decl_line: $ => seq(
      choice($.assignment, $.decl),
      $._newline
    ),

    _decl_block: $ => seq(
      repeat($._decl_line),
      $._dedent
    ),

    _decl_body: $ => choice(
      $._decl_line,
      seq($._indent, $._decl_block)
    ),

    declaration: $ => seq(
      choice('var', 'let', 'const'),
      alias(field('body', $._decl_body), $.block)
    ),

    // Misc

    attribute: $ => prec(PREC.call, seq(
      field('object', $._expression),
      $._period,
      field('attribute', $.identifier)
    )),

    subscript: $ => prec(PREC.subscript, seq(
      field('value', $._expression),
      '[',
      optional(sep1(choice(
        $._type_name,
        $.pair
      ), $._comma)),
      optional($._comma),
      ']'
    )),

    call: $ => prec(PREC.call, seq(
      field('function', $._expression),
      field('arguments', $.argument_list)
    )),

    typed_parameter: $ => seq(
      $.identifier,
      $._colon,
      optional('var'),
      field('type', $._type_name)
    ),

    _type_name: $ => seq(
      optional(choice('ref', 'ptr')),
      $._expression
    ),

    keyword_argument: $ => seq(
      field('name', choice($.identifier, $.string)),
      $._equals,
      field('value', $._expression)
    ),

    // Literals

    list: $ => seq(
      '[',
      optional(sep1($._expression, $._comma)),
      optional($._comma),
      ']'
    ),

    dictionary: $ => seq(
      '{',
      optional(sep1($.pair, $._comma)),
      optional($._comma),
      '}'
    ),

    pair: $ => seq(
      field('key', $._expression),
      $._colon,
      field('value', $._expression)
    ),

    set: $ => seq(
      '{',
      sep1($._expression, $._comma),
      optional($._comma),
      '}'
    ),

    parenthesized_expression: $ => prec(PREC.parenthesized_expression, seq(
      '(',
      $._expression,
      ')'
    )),

    tuple: $ => seq(
      '(',
      optional(sep1($._expression, $._comma)),
      optional($._comma),
      ')'
    ),

    string: $ => seq(
      alias($._string_start, '"'),
      repeat(choice($.interpolation, $.escape_sequence, $._not_escape_sequence, $._string_content)),
      alias($._string_end, '"')
    ),

    interpolation: $ => seq(
      '{',
      $._expression,
      optional($.type_conversion),
      optional($.format_specifier),
      '}'
    ),

    escape_sequence: $ => token(prec(1, seq(
      '\\',
      choice(
        /u[a-fA-F\d]{4}/,
        /U[a-fA-F\d]{8}/,
        /x[a-fA-F\d]{2}/,
        /\d{3}/,
        /\r?\n/,
        /['"abfrntv\\]/,
      )
    ))),

    _not_escape_sequence: $ => '\\',

    format_specifier: $ => seq(
      $._colon,
      repeat(choice(
        /[^{}\n]+/,
        $.format_expression
      ))
    ),

    format_expression: $ => seq('{', $._expression, '}'),

    type_conversion: $ => /![a-z]/,

    integer: $ => token(choice(
      seq(
        optional(choice('0b', '0o', '0x')),
        repeat1(/[0-9]+_?/),
        optional(choice(/[iI]/, /[iI]8/, /[iI]16/, /[iI]32/, /[iI]64/, /[uU]/, /[uU]8/, /[uU]16/, /[uU]32/, /[uU]64/))
      )
    )),

    float: $ => {
      const digits = repeat1(/[0-9]+_?/);
      const exponent = seq(/[eE][\+-]?/, digits)
      var suffix = choice(/[fF]/, /[fF]32/, /[fF]64/, /[dD]/, /[dD]32/, /[dD]64/);

      return token(seq(
        optional(choice('0b', '0o', '0x')),
        choice(
          seq(digits, '.', digits, optional(exponent), optional(suffix)),
          seq(digits, exponent, optional(suffix)),
          seq(digits, suffix)
        )
      ))
    },

    identifier: $ => /[a-zA-Zα-ωΑ-Ω_][a-zA-Zα-ωΑ-Ω_0-9]*/,

    // treat strings as identifiers, so backtick-quoted ids like `this` are treated like normal ids
    _id_or_str: $ => prec(PREC.private_id, choice($.identifier, alias($.string, $.identifier))),

    // function and type names that are marked as public
    public_id: $ => seq($._id_or_str, '*'),

    true: $ => 'true',
    false: $ => 'false',
    none: $ => 'nil',

    comment: $ => token(choice(
      seq(/#[^\[]/, /.*/),
      seq('#[', /[^\]]*\]+([^#\]][^\]]*\]+)*/, '#')
    )),

    _semicolon: $ => alias(';', $.op),
    _comma: $ => alias(',', $.op),
    _comma_or_semi: $ => choice($._semicolon, $._comma),
    _equals: $ => alias('=', $.op),
    _colon: $ => alias(':', $.op),
    _period: $ => alias('.', $.op),
    _slash: $ => alias('/', $.op),
    _star: $ => alias('*', $.op),
  }
})

function sep1 (rule, separator) {
  return seq(rule, repeat(seq(separator, rule)))
}
