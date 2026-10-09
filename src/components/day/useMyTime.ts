"use client";

import { useState, useTransition } from "react";
import { clearDay, saveDay, setBusy, setDayNote } from "@/app/actions";
import { bestWindow } from "@/lib/overlap";
import { DAY_HOURS } from "@/lib/time";
import { haptic } from "@/lib/tg";
import { cleanNote, isPhone, toRange, type Range, type Row } from "./timeScale";

/**
 * Своё время на шкале дня: выбор начала и конца (на компьютере — двумя нажатиями,
 * на телефоне — на циферблате), «NO», выбранные игры, заметка и сохранение.
 * Всё меняется на экране сразу, а сохраняется в фоне.
 */
export function useMyTime({
  day,
  mine,
  others,
  initialGames,
  maxGames,
}: {
  day: string;
  mine: Row;
  others: Row[];
  initialGames: number[];
  maxGames: number;
}) {
  const [range, setRange] = useState<Range | null>(toRange(mine.hours));
  const [busy, setBusyState] = useState(mine.state === "busy");
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [dial, setDial] = useState(false);
  const [dialValue, setDialValue] = useState<Range>([12, 16]);
  const [picked, setPicked] = useState<number[]>(initialGames);
  const [popover, setPopover] = useState(false);
  const [grown, setGrown] = useState(0); // перезапуск анимации полосы
  // Заметка: что набрано в окне игр и что уже сохранено (её и видно на шкале).
  const [note, setNote] = useState(mine.comment ?? "");
  const [savedNote, setSavedNote] = useState(mine.comment ?? "");
  const [, start] = useTransition();

  // Сбой сети не должен ронять шкалу: время останется на экране, а данные подтянутся при обновлении.
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        console.error(e);
      }
    });

  const hoursOf = (r: Range) => Array.from({ length: r[1] - r[0] }, (_, i) => r[0] + i);
  const save = (r: Range, g: number[]) => run(() => saveDay(day, hoursOf(r), g));

  /** Без времени заметки нет: строка дня удаляется или становится «NO». */
  const dropNote = () => {
    setNote("");
    setSavedNote("");
  };

  // Сколько остальных свободно в каждый час — для подсветки на циферблате.
  const othersCounts = new Array<number>(DAY_HOURS).fill(0);
  others.forEach((r) => r.hours.forEach((h) => othersCounts[h]++));

  /** Телефон: циферблат. Начинаем с моего времени, иначе — с общего окна остальных, иначе — от места касания. */
  const openDial = (near?: number) => {
    const theirs = bestWindow(othersCounts);
    const start = near ?? 12;
    setDialValue(range ?? (theirs ? [theirs.from, theirs.to] : [start, Math.min(DAY_HOURS, start + 3)]));
    setAnchor(null);
    setPopover(false);
    setDial(true);
    haptic("select");
  };

  const confirmDial = () => {
    const r = dialValue;
    haptic("success");
    setRange(r);
    setBusyState(false);
    setDial(false);
    setPopover(true);
    setGrown((n) => n + 1);
    save(r, picked);
  };

  const pick = (h: number) => {
    if (anchor === null && isPhone()) return openDial(h);
    haptic(anchor === null ? "select" : "success");
    if (anchor === null) {
      setAnchor(h);
      setHover(h);
      return;
    }
    const r: Range = [Math.min(anchor, h), Math.max(anchor, h) + 1];
    setRange(r);
    setBusyState(false);
    setAnchor(null);
    setHover(null);
    setPopover(true);
    setGrown((n) => n + 1);
    save(r, picked); // время сохраняется сразу, игры — по «Готово»
  };

  const remove = () => {
    setRange(null);
    setPopover(false);
    dropNote();
    run(() => clearDay(day));
  };

  const markBusy = (value: boolean) => {
    setBusyState(value);
    setAnchor(null);
    if (value) {
      setRange(null);
      setPopover(false);
    }
    // При «NO» строка дня остаётся — заметку к времени стираем, чтобы она не всплыла потом.
    const hadNote = !!savedNote;
    dropNote();
    run(async () => {
      if (!value) return clearDay(day);
      await setBusy(day);
      if (hadNote) await setDayNote(day, "");
    });
  };

  const togglePick = (id: number) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= maxGames ? prev : [...prev, id]));

  /** «Готово» в окне игр: закрыть и сохранить выбранные игры и заметку (после времени — строка дня уже есть). */
  const done = (r: Range) => {
    setPopover(false);
    const text = cleanNote(note);
    const noteChanged = text !== savedNote;
    setNote(text);
    setSavedNote(text);
    run(async () => {
      await saveDay(day, hoursOf(r), picked);
      if (noteChanged) await setDayNote(day, text);
    });
  };

  /** «Другое время»: на телефоне — снова циферблат, на компьютере — выбор заново с прежним началом. */
  const repick = (r: Range) => {
    if (isPhone()) return openDial();
    setPopover(false);
    setAnchor(r[0]);
    setHover(r[1] - 1);
    setRange(null);
  };

  /** При уходе указателя с шкалы предпросмотр сжимается до начала. */
  const hoverHour = (h: number) => anchor !== null && setHover(h);

  const preview: Range | null = anchor !== null ? [Math.min(anchor, hover ?? anchor), Math.max(anchor, hover ?? anchor) + 1] : null;

  return {
    range,
    busy,
    anchor,
    preview,
    picked,
    note,
    savedNote,
    setNote,
    popover,
    grown,
    dial,
    dialValue,
    othersCounts,
    setDialValue,
    closeDial: () => setDial(false),
    togglePopover: () => setPopover((v) => !v),
    pick,
    hoverHour,
    confirmDial,
    remove,
    markBusy,
    togglePick,
    done,
    repick,
  };
}
