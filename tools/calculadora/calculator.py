"""
Módulo de cálculo matemático da Calculadora.

Fornece a classe Calculator com suporte a operações aritméticas fundamentais,
validação estrita de tipos, tratamento de exceções (como divisão por zero)
e histórico em memória de cálculos realizados.
"""

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import Enum
import math
from typing import Any, Dict, List, Union


class Operation(str, Enum):
    """Operações aritméticas suportadas pela calculadora."""
    ADD = "add"
    SUBTRACT = "subtract"
    MULTIPLY = "multiply"
    DIVIDE = "divide"

    @classmethod
    def from_string(cls, value: str) -> "Operation":
        """Converte uma string ou símbolo na operação correspondente."""
        clean = value.strip().lower()
        mapping = {
            "add": cls.ADD,
            "+": cls.ADD,
            "soma": cls.ADD,
            "somar": cls.ADD,
            "adicao": cls.ADD,
            "adição": cls.ADD,
            "subtract": cls.SUBTRACT,
            "-": cls.SUBTRACT,
            "sub": cls.SUBTRACT,
            "subtracao": cls.SUBTRACT,
            "subtração": cls.SUBTRACT,
            "subtrair": cls.SUBTRACT,
            "multiply": cls.MULTIPLY,
            "*": cls.MULTIPLY,
            "x": cls.MULTIPLY,
            "mult": cls.MULTIPLY,
            "multiplicacao": cls.MULTIPLY,
            "multiplicação": cls.MULTIPLY,
            "multiplicar": cls.MULTIPLY,
            "divide": cls.DIVIDE,
            "/": cls.DIVIDE,
            "div": cls.DIVIDE,
            "divisao": cls.DIVIDE,
            "divisão": cls.DIVIDE,
            "dividir": cls.DIVIDE,
        }
        if clean in mapping:
            return mapping[clean]
        raise InvalidOperationError(
            f"Operação inválida: '{value}'. Operações suportadas: add (+), subtract (-), multiply (*), divide (/)."
        )


class CalculatorError(Exception):
    """Classe base para erros da calculadora."""
    pass


class DivisionByZeroError(CalculatorError):
    """Lançada ao tentar dividir qualquer número por zero."""
    pass


class InvalidOperationError(CalculatorError):
    """Lançada quando a operação solicitada não é reconhecida."""
    pass


class InvalidOperandError(CalculatorError):
    """Lançada quando um dos operandos não é numérico ou não é finito."""
    pass


@dataclass(frozen=True)
class CalculationRecord:
    """Registro imutável de uma operação de cálculo realizada."""
    operation: str
    symbol: str
    a: Union[int, float]
    b: Union[int, float]
    result: Union[int, float]
    expression: str
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        """Serializa o registro para dicionário JSON-compatível."""
        return asdict(self)


def format_number(value: float, precision: int = 8) -> Union[int, float]:
    """
    Formata um número de ponto flutuante:
    - Retorna int se o valor for um número inteiro exato (ex: 5.0 -> 5).
    - Arredonda dízimas de ponto flutuante indesejadas (ex: 0.1 + 0.2 -> 0.3).
    """
    if not math.isfinite(value):
        raise InvalidOperandError("O resultado não é um número finito.")

    rounded = round(value, precision)
    if rounded == int(rounded):
        return int(rounded)
    return rounded


class Calculator:
    """
    Motor matemático da calculadora com suporte a histórico em memória.
    """

    SYMBOLS = {
        Operation.ADD: "+",
        Operation.SUBTRACT: "-",
        Operation.MULTIPLY: "×",
        Operation.DIVIDE: "÷",
    }

    def __init__(self, max_history: int = 50) -> None:
        """
        Inicializa a calculadora.

        Args:
            max_history: Quantidade máxima de cálculos mantidos no histórico.
        """
        self._history: List[CalculationRecord] = []
        self._max_history = max_history

    def _validate_operand(self, val: Any, name: str) -> float:
        """Garante que o operando seja um float ou int finito."""
        if val is None or isinstance(val, bool):
            raise InvalidOperandError(f"O operando '{name}' deve ser um número válido.")
        try:
            num = float(val)
        except (ValueError, TypeError):
            raise InvalidOperandError(f"O operando '{name}' deve ser um número válido, recebido: {val!r}")

        if not math.isfinite(num):
            raise InvalidOperandError(f"O operando '{name}' não pode ser infinito ou NaN.")

        return num

    def add(self, a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
        """Realiza a soma de dois números: a + b."""
        num_a = self._validate_operand(a, "a")
        num_b = self._validate_operand(b, "b")
        return format_number(num_a + num_b)

    def subtract(self, a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
        """Realiza a subtração de dois números: a - b."""
        num_a = self._validate_operand(a, "a")
        num_b = self._validate_operand(b, "b")
        return format_number(num_a - num_b)

    def multiply(self, a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
        """Realiza a multiplicação de dois números: a * b."""
        num_a = self._validate_operand(a, "a")
        num_b = self._validate_operand(b, "b")
        return format_number(num_a * num_b)

    def divide(self, a: Union[int, float], b: Union[int, float]) -> Union[int, float]:
        """
        Realiza a divisão de dois números: a / b.

        Raises:
            DivisionByZeroError: Se o divisor b for zero.
        """
        num_a = self._validate_operand(a, "a")
        num_b = self._validate_operand(b, "b")
        if num_b == 0.0:
            raise DivisionByZeroError("Divisão por zero não é permitida.")
        return format_number(num_a / num_b)

    def calculate(
        self,
        operation: Union[Operation, str],
        a: Union[int, float],
        b: Union[int, float],
    ) -> CalculationRecord:
        """
        Executa uma operação matemática estruturada e armazena no histórico.

        Args:
            operation: Nome ou símbolo da operação ('add', 'subtract', 'multiply', 'divide', etc.)
            a: Primeiro operando
            b: Segundo operando

        Returns:
            CalculationRecord com os dados da operação e resultado formatado.
        """
        if not isinstance(operation, Operation):
            op_enum = Operation.from_string(str(operation))
        else:
            op_enum = operation

        if op_enum == Operation.ADD:
            res = self.add(a, b)
        elif op_enum == Operation.SUBTRACT:
            res = self.subtract(a, b)
        elif op_enum == Operation.MULTIPLY:
            res = self.multiply(a, b)
        elif op_enum == Operation.DIVIDE:
            res = self.divide(a, b)
        else:
            raise InvalidOperationError(f"Operação não implementada: {op_enum}")

        fmt_a = format_number(float(a))
        fmt_b = format_number(float(b))
        symbol = self.SYMBOLS[op_enum]
        expression = f"{fmt_a} {symbol} {fmt_b} = {res}"

        record = CalculationRecord(
            operation=op_enum.value,
            symbol=symbol,
            a=fmt_a,
            b=fmt_b,
            result=res,
            expression=expression,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

        self._history.append(record)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        return record

    def get_history(self) -> List[CalculationRecord]:
        """Retorna uma cópia da lista de cálculos realizados."""
        return list(self._history)

    def clear_history(self) -> None:
        """Limpa o histórico de cálculos."""
        self._history.clear()
