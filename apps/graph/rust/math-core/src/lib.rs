//! Bounded, real-valued expression execution for browser and geometry workers.
//! The app's canonical safety/parser layer emits a postfix program; no source
//! code, callbacks, imports, or browser objects enter this numerical core.

pub const MAX_PROGRAM_VALUES: usize = 20_000;

fn nearly_equal(a: f64, b: f64) -> bool {
    if a == b {
        return true;
    }
    let difference = (a - b).abs();
    a.is_finite()
        && b.is_finite()
        && (difference <= 1e-15 || difference <= a.abs().max(b.abs()) * 1e-12)
}

fn round_decimal(value: f64, places: f64) -> f64 {
    if places.fract() != 0.0 || !(0.0..=15.0).contains(&places) {
        return f64::NAN;
    }
    if !value.is_finite() {
        return value;
    }
    let mut selected = value;
    if places < 12.0 {
        let normalized = (value * 1e12).round() / 1e12;
        if nearly_equal(value, normalized) {
            selected = normalized;
        }
    }
    let scale = 10_f64.powf(places);
    let scaled = selected.abs() * scale;
    if !scaled.is_finite() {
        return value;
    }
    // Decimal ties can be a few binary ulps below .5 after multiplication.
    // Match the canonical decimal rounding and ties away from zero.
    ((scaled + 0.5 + scaled * f64::EPSILON * 2.0).floor() / scale).copysign(selected)
}

pub fn evaluate(code: &[f64], scope: &[f64]) -> f64 {
    if !code.len().is_multiple_of(2) || code.len() > MAX_PROGRAM_VALUES {
        return f64::NAN;
    }
    let mut stack = Vec::with_capacity(code.len() / 2);
    let mut pc = 0;
    let mut budget = MAX_PROGRAM_VALUES;
    while pc < code.len() && budget > 0 {
        budget -= 1;
        let op = code[pc] as u32;
        let arg = code[pc + 1];
        pc += 2;
        match op {
            0 => stack.push(arg),
            1 => stack.push(*scope.get(arg as usize).unwrap_or(&f64::NAN)),
            40 => {
                let Some(value) = stack.pop() else {
                    return f64::NAN;
                };
                if value == 0.0 {
                    pc = arg as usize;
                }
            }
            41 => pc = arg as usize,
            2..=7 | 23 | 24 | 26..=28 | 30..=38 => {
                let (Some(b), Some(a)) = (stack.pop(), stack.pop()) else {
                    return f64::NAN;
                };
                stack.push(match op {
                    2 => a + b,
                    3 => a - b,
                    4 => a * b,
                    5 => a / b,
                    6 => a.powf(b),
                    7 => a - b * (a / b).floor(),
                    23 => a.atan2(b),
                    24 => a.ln() / b.ln(),
                    26 => {
                        if a.is_nan() || b.is_nan() {
                            f64::NAN
                        } else {
                            a.min(b)
                        }
                    }
                    27 => {
                        if a.is_nan() || b.is_nan() {
                            f64::NAN
                        } else {
                            a.max(b)
                        }
                    }
                    28 => round_decimal(a, b),
                    30 => nearly_equal(a, b) as u8 as f64,
                    31 => (!nearly_equal(a, b)) as u8 as f64,
                    32 => (a < b && !nearly_equal(a, b)) as u8 as f64,
                    33 => (a < b || nearly_equal(a, b)) as u8 as f64,
                    34 => (a > b && !nearly_equal(a, b)) as u8 as f64,
                    35 => (a > b || nearly_equal(a, b)) as u8 as f64,
                    36 => ((a != 0.0) && (b != 0.0)) as u8 as f64,
                    37 => ((a != 0.0) || (b != 0.0)) as u8 as f64,
                    38 => ((a != 0.0) ^ (b != 0.0)) as u8 as f64,
                    _ => unreachable!(),
                });
            }
            8..=22 | 25 | 39 => {
                let Some(a) = stack.pop() else {
                    return f64::NAN;
                };
                stack.push(match op {
                    8 => -a,
                    9 => a.sin(),
                    10 => a.cos(),
                    11 => a.tan(),
                    12 => a.asin(),
                    13 => a.acos(),
                    14 => a.atan(),
                    15 => a.sqrt(),
                    16 => a.abs(),
                    17 => a.exp(),
                    18 => a.ln(),
                    19 => a.floor(),
                    20 => a.ceil(),
                    21 => round_decimal(a, 0.0),
                    22 => {
                        if a == 0.0 {
                            a
                        } else if a.is_nan() {
                            f64::NAN
                        } else {
                            a.signum()
                        }
                    }
                    25 => round_decimal(a, arg),
                    39 => (a == 0.0) as u8 as f64,
                    _ => unreachable!(),
                });
            }
            _ => return f64::NAN,
        }
        if pc % 2 != 0 || pc > code.len() {
            return f64::NAN;
        }
    }
    if budget == 0 || stack.len() != 1 {
        f64::NAN
    } else {
        stack[0]
    }
}

// These functions are a small private WASM ABI. Only allocations made through
// alloc_values are passed back by the typed app bridge; lengths are bounded.
#[no_mangle]
pub extern "C" fn alloc_values(len: usize) -> *mut f64 {
    if len > 1_000_000 {
        return std::ptr::null_mut();
    }
    let values = vec![0.0; len].into_boxed_slice();
    Box::into_raw(values) as *mut f64
}

/// # Safety
/// ptr must be returned by alloc_values with the same len, and freed once.
#[no_mangle]
pub unsafe extern "C" fn free_values(ptr: *mut f64, len: usize) {
    if !ptr.is_null() {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
    }
}

/// # Safety
/// Both pointers refer to live alloc_values allocations of the supplied lengths.
#[no_mangle]
pub unsafe extern "C" fn evaluate_values(
    code: *const f64,
    code_len: usize,
    scope: *const f64,
    scope_len: usize,
) -> f64 {
    if code.is_null() || scope.is_null() || code_len > MAX_PROGRAM_VALUES || scope_len > 2500 {
        return f64::NAN;
    }
    evaluate(
        std::slice::from_raw_parts(code, code_len),
        std::slice::from_raw_parts(scope, scope_len),
    )
}

/// Samples a Cartesian grid entirely inside WASM. Each axis is represented by
/// [symbol slot (-1 when unused), min, max, count], with x varying fastest.
/// # Safety
/// All pointers are disjoint live alloc_values allocations of the supplied
/// sizes. config has exactly 12 values; output has output_len values.
#[no_mangle]
pub unsafe extern "C" fn sample_grid_values(
    code: *const f64,
    code_len: usize,
    scope: *mut f64,
    scope_len: usize,
    config: *const f64,
    output: *mut f64,
    output_len: usize,
) -> usize {
    if code.is_null()
        || scope.is_null()
        || config.is_null()
        || output.is_null()
        || code_len > MAX_PROGRAM_VALUES
        || scope_len > 2500
        || output_len > 2048
    {
        return 0;
    }
    let code = std::slice::from_raw_parts(code, code_len);
    let scope = std::slice::from_raw_parts_mut(scope, scope_len);
    let config = std::slice::from_raw_parts(config, 12);
    let counts = [config[3] as usize, config[7] as usize, config[11] as usize];
    if counts.iter().any(|n| *n == 0 || *n > 32) {
        return 0;
    }
    let total = counts.iter().product::<usize>();
    if total > output_len {
        return 0;
    }
    let output = std::slice::from_raw_parts_mut(output, output_len);
    let mut offset = 0;
    for k in 0..counts[2] {
        for j in 0..counts[1] {
            for i in 0..counts[0] {
                for (axis, step) in [i, j, k].iter().enumerate() {
                    let base = axis * 4;
                    let slot = config[base];
                    if slot >= 0.0 {
                        let Some(value) = scope.get_mut(slot as usize) else {
                            return 0;
                        };
                        *value = if counts[axis] == 1 {
                            config[base + 1]
                        } else {
                            config[base + 1]
                                + *step as f64
                                    * ((config[base + 2] - config[base + 1])
                                        / (counts[axis] - 1) as f64)
                        };
                    }
                }
                output[offset] = evaluate(code, scope);
                offset += 1;
            }
        }
    }
    offset
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn arithmetic_and_parameters() {
        // sin(x) + y^2
        let code = [1., 0., 9., 0., 1., 1., 0., 2., 6., 0., 2., 0.];
        assert!((evaluate(&code, &[0.5, 3.]) - (0.5_f64.sin() + 9.)).abs() < 1e-12);
    }
    #[test]
    fn singularities_remain_nonfinite() {
        assert!(evaluate(&[0., 0., 0., 0., 5., 0.], &[]).is_nan());
        assert!(evaluate(&[0., -1., 15., 0.], &[]).is_nan());
        assert!(evaluate(&[0., 1., 0., 0., 5., 0.], &[]).is_infinite());
    }
    #[test]
    fn malformed_and_unbounded_programs_fail_closed() {
        assert!(evaluate(&[2., 0.], &[]).is_nan());
        assert!(evaluate(&[99., 0.], &[]).is_nan());
        assert!(evaluate(&[41., 0.], &[]).is_nan());
        assert!(evaluate(&vec![0.; MAX_PROGRAM_VALUES + 2], &[]).is_nan());
    }
    #[test]
    fn atan2_mod_and_comparisons() {
        assert_eq!(evaluate(&[0., -5., 0., 3., 7., 0.], &[]), 1.);
        assert_eq!(evaluate(&[0., 2., 0., 3., 32., 0.], &[]), 1.);
        assert!(
            (evaluate(&[0., 1., 0., 0., 23., 0.], &[]) - std::f64::consts::FRAC_PI_2).abs() < 1e-12
        );
    }
}
