const PREC = {
  omit_parens: -2,
  conditional: -1,

  parenthesized_expression: 1,

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

  call: 21,
}

module.exports = grammar({
  name: 'nim',

  extras: $ => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\\\r?\n/
  ],

  supertypes: $ => [
    $._simple_statement,
    $._compound_statement,
    $._expression,
    $._expression,
    $._parameter,
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
    module: $ => repeat($._statement),

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
      $.assert_statement,
      $.expression_statement,
      $.return_statement,
      $.raise_statement,
      $.pass_statement,
      $.break_statement,
      $.continue_statement
    ),

    import_statement: $ => seq(
      'import',
      $._import_list
    ),

    import_prefix: $ => repeat1('.'),

    relative_import: $ => seq(
      $.import_prefix,
      optional($.slashed_name)
    ),

    import_from_statement: $ => seq(
      'from',
      field('module_name', choice(
        $.relative_import,
        $.slashed_name
      )),
      'import',
      choice(
        $.wildcard_import,
        $._import_list,
        seq('(', $._import_list, ')')
      )
    ),

    _import_list: $ => seq(
      commaSep1(field('name', choice(
        $.slashed_name,
        $.aliased_import
      ))),
      optional(',')
    ),

    aliased_import: $ => seq(
      field('name', $.slashed_name),
      'as',
      field('alias', $.identifier)
    ),

    wildcard_import: $ => '*',

    omit_parens_statement: $ =>
      prec(PREC.omit_parens, seq(
        $.identifier,
        commaSep1(field('argument', $._expression)),
        optional(','))
      ),

    assert_statement: $ => seq(
      'assert',
      commaSep1($._expression)
    ),

    expression_statement: $ => choice(
      $._expression,
      seq(commaSep1($._expression), optional(',')),
      $.assignment,
      //$.declaration,
    ),

    return_statement: $ => seq(
      'return',
      optional($.expression_list)
    ),

    raise_statement: $ => seq(
      'raise',
      optional($.expression_list),
      optional(seq('from', field('cause', $._expression)))
    ),

    pass_statement: $ => prec.left('pass'),
    break_statement: $ => prec.left('break'),
    continue_statement: $ => prec.left('continue'),

    // Compount statements

    _compound_statement: $ => choice(
      // not ready for prime time...
      //$.function_definition,
      $.generic_statement
    ),

    generic_statement: $ => seq(
      $.identifier,
      optional($._expression),
      ':',
      field('body', $._suite)
    ),

    function_definition: $ => seq(
      choice('proc', 'func'),
      field('name', choice($.identifier, $.string)),
      field('parameters', $.parameters),
      optional(
        seq(
          ':',
          field('return_type', $.type)
        )
      ),
      optional(
        seq(
          alias('=', $.op),
          field('body', $._suite)
        )
      ),
    ),

    parameters: $ => seq(
      '(',
      optional($._parameters),
      ')'
    ),

    _parameters: $ => seq(
      commaOrSemiSep1($._parameter),
      optional(choice(',', ';'))
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
      '=',
      field('value', $._expression)
    ),

    typed_default_parameter: $ => seq(
      field('name', choice($.identifier, $.string)),
      ':',
      field('type', $.type),
      '=',
      field('value', $._expression)
    ),

    argument_list: $ => seq(
      '(',
      optional(commaSep1(
        choice(
          $._expression,
          $.keyword_argument
        )
      )),
      optional(','),
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
      commaSep1(choice($.identifier, $.tuple)),
      optional(',')
    ),

    expression_list: $ => prec.right(seq(
      commaSep1($._expression),
      optional(',')
    )),

    slashed_name: $ => sep1($.identifier, '/'),

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
        [prec.left, '*', PREC.op9], // starts with * and ends with anyhting but :
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
        optional(field('left', $._expression)),
        alias(operator, $.op),
        field('right', $._expression)
      ))));
    },

    assignment: $ => seq(
      field('left', $.expression_list),
      alias('=', $.op),
      field('right', $._suite)
    ),

    declaration: $ => seq(
      choice('var', 'let', 'const'),
      field('left', $.expression_list),
      choice(
        seq(alias('=', $.op), field('right', $._suite)),
        seq(':', field('type', $.type)),
        seq(':', field('type', $.type), alias('=', $.op), field('right', $._suite))
      )
    ),

    attribute: $ => prec(PREC.call, seq(
      field('object', $._expression),
      '.',
      field('attribute', $.identifier)
    )),

    subscript: $ => seq(
      field('value', $._expression),
      '[',
      field('subscript', commaSep1($._expression)),
      ']'
    ),

    call: $ => prec(PREC.call, seq(
      field('function', $._expression),
      field('arguments', $.argument_list)
    )),

    typed_parameter: $ => seq(
      $.identifier,
      ':',
      field('type', $.type)
    ),

    type: $ => $._expression,

    keyword_argument: $ => seq(
      field('name', choice($.identifier, $.string)),
      '=',
      field('value', $._expression)
    ),

    // Literals

    list: $ => seq(
      '[',
      optional(commaSep1($._expression)),
      optional(','),
      ']'
    ),

    dictionary: $ => seq(
      '{',
      optional(commaSep1($.pair)),
      optional(','),
      '}'
    ),

    pair: $ => seq(
      field('key', $._expression),
      ':',
      field('value', $._expression)
    ),

    set: $ => seq(
      '{',
      commaSep1($._expression),
      optional(','),
      '}'
    ),

    parenthesized_expression: $ => prec(PREC.parenthesized_expression, seq(
      '(',
      $._expression,
      ')'
    )),

    tuple: $ => seq(
      '(',
      optional(commaSep1($._expression)),
      optional(','),
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
      ':',
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

    true: $ => 'true',
    false: $ => 'false',
    none: $ => 'nil',

    comment: $ => token(choice(
      seq(/#[^\[]/, /.*/),
      seq('#[', /[^\]]*\]+([^#\]][^\]]*\]+)*/, '#')
    )),

    _semicolon: $ => ';'
  }
})

function commaSep1 (rule) {
  return sep1(rule, ',')
}

function commaOrSemiSep1 (rule) {
  return sep1(rule, choice(',', ';'))
}

function sep1 (rule, separator) {
  return seq(rule, repeat(seq(separator, rule)))
}
