//! Bounded, real-valued expression execution for browser and geometry workers.
//! The app's canonical safety/parser layer emits a postfix program; no source
//! code, callbacks, imports, or browser objects enter this numerical core.

pub const MAX_PROGRAM_VALUES: usize = 20_000;

pub fn evaluate(code: &[f64], scope: &[f64]) -> f64 {
    if code.len() % 2 != 0 || code.len() > MAX_PROGRAM_VALUES {
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
                let Some(value) = stack.pop() else { return f64::NAN };
                if value == 0.0 { pc = arg as usize; }
            }
            41 => pc = arg as usize,
            2..=7 | 23 | 24 | 26 | 27 | 30..=38 => {
                let (Some(b), Some(a)) = (stack.pop(), stack.pop()) else { return f64::NAN };
                stack.push(match op {
                    2 => a + b, 3 => a - b, 4 => a * b, 5 => a / b,
                    6 => a.powf(b), 7 => a - b * (a / b).floor(),
                    23 => a.atan2(b), 24 => a.ln() / b.ln(),
                    26 => a.min(b), 27 => a.max(b),
                    30 => (a == b) as u8 as f64, 31 => (a != b) as u8 as f64,
                    32 => (a < b) as u8 as f64, 33 => (a <= b) as u8 as f64,
                    34 => (a > b) as u8 as f64, 35 => (a >= b) as u8 as f64,
                    36 => ((a != 0.0) && (b != 0.0)) as u8 as f64,
                    37 => ((a != 0.0) || (b != 0.0)) as u8 as f64,
                    38 => ((a != 0.0) ^ (b != 0.0)) as u8 as f64,
                    _ => unreachable!(),
                });
            }
            8..=22 | 25 | 39 => {
                let Some(a) = stack.pop() else { return f64::NAN };
                stack.push(match op {
                    8 => -a, 9 => a.sin(), 10 => a.cos(), 11 => a.tan(),
                    12 => a.asin(), 13 => a.acos(), 14 => a.atan(), 15 => a.sqrt(),
                    16 => a.abs(), 17 => a.exp(), 18 => a.ln(), 19 => a.floor(),
                    20 => a.ceil(), 21 => (a + 0.5).floor(),
                    22 => if a == 0.0 { a } else if a.is_nan() { f64::NAN } else { a.signum() },
                    25 => { let scale = 10_f64.powf(arg); (a * scale + 0.5).floor() / scale },
                    39 => (a == 0.0) as u8 as f64,
                    _ => unreachable!(),
                });
            }
            _ => return f64::NAN,
        }
        if pc % 2 != 0 || pc > code.len() { return f64::NAN; }
    }
    if budget == 0 || stack.len() != 1 { f64::NAN } else { stack[0] }
}

// These functions are a small private WASM ABI. Only allocations made through
// alloc_values are passed back by the typed app bridge; lengths are bounded.
#[no_mangle]
pub extern "C" fn alloc_values(len: usize) -> *mut f64 {
    if len > 1_000_000 { return std::ptr::null_mut(); }
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
pub unsafe extern "C" fn evaluate_values(code: *const f64, code_len: usize, scope: *const f64, scope_len: usize) -> f64 {
    if code.is_null() || scope.is_null() || code_len > MAX_PROGRAM_VALUES || scope_len > 2500 { return f64::NAN; }
    evaluate(std::slice::from_raw_parts(code, code_len), std::slice::from_raw_parts(scope, scope_len))
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
        assert!((evaluate(&[0., 1., 0., 0., 23., 0.], &[]) - std::f64::consts::FRAC_PI_2).abs() < 1e-12);
    }
}
